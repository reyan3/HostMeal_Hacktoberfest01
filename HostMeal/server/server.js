import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// -----------------------------
// Generate meals using Gemma Model
// -----------------------------

function parseGemmaJson(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Gemma returned an empty response");
  }

  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/g, "").trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const fallback = cleaned.match(/\{[\s\S]*\}/)?.[0];

    if (fallback) {
      try {
        return JSON.parse(fallback);
      } catch {
        // intentionally fall through to the final error below
      }
    }

    throw new Error(`Gemma returned invalid JSON: ${error.message}`);
  }
}

async function generateMealsWithGemma({
  ingredients,
  budget,
  time,
  servings,
  goal,
  equipment,
  diet,
  mealType,
  taste,
}) {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN is missing. Add it to your server environment.");
  }

  const prompt = `
You are HostMeal AI, a hostel cooking assistant.

Create exactly 3 practical meal suggestions using the user's available ingredients.

User ingredients: ${ingredients.join(", ")}
Budget: ₹${budget}
Maximum cooking time: ${time} minutes
Servings: ${servings}
Diet: ${diet}
Meal type: ${mealType}
Goal: ${goal}
Equipment: ${equipment}
Taste: ${taste}

Rules:
- Prefer ingredients the user already has.
- Stay within the budget.
- Respect the cooking time and equipment.
- Respect the diet.
- Keep recipes simple for hostel students.
- Return ONLY valid JSON.
- Do not use markdown.

JSON format:
{
  "meals": [
    {
      "name": "Meal name",
      "emoji": "🍳",
      "description": "Short description",
      "cost": 50,
      "time": 15,
      "protein": 12,
      "ingredients": ["ingredient 1", "ingredient 2"],
      "missing": ["ingredient"],
      "steps": [
        "Step 1",
        "Step 2",
        "Step 3"
      ]
    }
  ]
}
`;

  const response = await axios.post(
    "https://router.huggingface.co/v1/chat/completions",
    {
      model: "google/gemma-3-4b-it",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1800,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data.choices?.[0]?.message?.content;

  return parseGemmaJson(content);
}

// -----------------------------
// Search YouTube
// -----------------------------

async function searchYouTube(mealName) {
  if (!process.env.YT_KEY) {
    throw new Error("YT_KEY is missing. Add it to your server environment.");
  }

  const response = await axios.get(
    "https://www.googleapis.com/youtube/v3/search",
    {
      params: {
        part: "snippet",
        q: `${mealName} easy recipe few ingredients simple homemade`,
        type: "video",
        maxResults: 1,
        key: process.env.YT_KEY,
      },
    }
  );

  const video = response.data.items?.[0];

  if (!video) {
    return null;
  }

  return {
    videoId: video.id.videoId,
    title: video.snippet.title,
    channel: video.snippet.channelTitle,
    thumbnail:
      video.snippet.thumbnails?.medium?.url ||
      video.snippet.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
  };
}

// -----------------------------
// Meals API
// -----------------------------

app.post("/api/meals", async (req, res) => {
  try {
    const {
      ingredients,
      budget,
      time,
      servings,
      goal,
      equipment,
      diet,
      mealType,
      taste,
    } = req.body;

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({
        error: "At least one ingredient is required.",
      });
    }

    // 1. Generate meals
    const result = await generateMealsWithGemma({
      ingredients,
      budget,
      time,
      servings,
      goal,
      equipment,
      diet,
      mealType,
      taste,
    });

    const meals = result.meals || [];

    // 2. Find YouTube videos in parallel
    const mealsWithVideos = await Promise.all(
      meals.map(async (meal) => {
        try {
          const video = await searchYouTube(meal.name);

          return {
            ...meal,
            youtube: video,
          };
        } catch (error) {
          console.error(
            `YouTube search failed for ${meal.name}:`,
            error.response?.data || error.message
          );
          return {
            ...meal,
            youtube: null,
          };
        }
      })
    );

    // 3. Send everything to frontend
    res.json({
      meals: mealsWithVideos,
    });
  } catch (error) {
    console.error(
      "Meal generation error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to generate meals.",
    });
  }
});

// -----------------------------
// Health check
// -----------------------------

app.get("/", (req, res) => {
  res.json({
    message: "HostMeal API is running",
  });
});

app.listen(PORT, () => {
  console.log(`HostMeal backend running on http://localhost:${PORT}`);
});