const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/questions", async (req, res) => {
    try {

        const { role } = req.query;

        if (!role || !["traveller", "local"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Valid role is required."
            });
        }

        const [questions] = await pool.query(`
            SELECT
                q.id,
                q.question_text,
                q.subtitle,
                q.question_type,
                q.display_order,
                qo.id AS option_id,
                qo.emoji,
                qo.option_title,
                qo.option_description,
                qo.trait_tags
            FROM questions q
            LEFT JOIN question_options qo
                ON q.id = qo.question_id
            WHERE q.role = ?
            ORDER BY q.display_order, qo.id
        `,[role]);

        const formattedQuestions = [];

        for (const row of questions) {
            let question = formattedQuestions.find(
                q => q.id === row.id
            );

            if (!question) {
                question = {
                    id: row.id,
                    questionText: row.question_text,
                    subtitle: row.subtitle,
                    questionType: row.question_type,
                    displayOrder: row.display_order,
                    options: []
                };

                formattedQuestions.push(question);
            }

            if (row.option_id) {
                question.options.push({
                    id: row.option_id,
                    emoji: row.emoji,
                    title: row.option_title,
                    description: row.option_description,
                    traitTags: row.trait_tags
                });
            }
        }

        res.json({
            success: true,
            questions: formattedQuestions
        });

    } catch (error) {
        console.error("Error fetching questions:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch questions."
        });
    }
});

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            message: "Belong backend and MySQL are connected."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

app.get("/api/locals", async (req, res) => {
    try {
        const { travellerCity, travellerProfileId } = req.query;

        if (!travellerCity) {
            return res.status(400).json({
                success: false,
                message: "Traveller city is required."
            });
        }

        const tProfileId = travellerProfileId ? parseInt(travellerProfileId, 10) : null;

        let travellerTags = new Set();
        let travellerOptionTitles = [];

        if (tProfileId) {
            const [taRows] = await pool.query(
                `SELECT qo.option_title, qo.trait_tags
                 FROM profile_answers pa
                 LEFT JOIN question_options qo ON pa.option_id = qo.id
                 JOIN questions q ON pa.question_id = q.id
                 WHERE pa.profile_id = ? AND q.role = 'traveller' AND q.display_order = 1`,
                [tProfileId]
            );
            for (const row of taRows) {
                if (row.trait_tags) {
                    row.trait_tags.split(",").map(t => t.trim()).filter(Boolean).forEach(t => travellerTags.add(t));
                }
                if (row.option_title) {
                    travellerOptionTitles.push(row.option_title);
                }
            }
        }

        const [locals] = await pool.query(
            `SELECT p.id, p.display_name, p.city, u.email
             FROM profiles p
             JOIN users u ON p.user_id = u.id
             WHERE p.city = ? AND u.role = 'local'
             LIMIT 50`,
            [travellerCity]
        );

        const scored = await Promise.all(locals.map(async (local) => {
            const [laRows] = await pool.query(
                `SELECT qo.option_title, qo.trait_tags
                 FROM profile_answers pa
                 LEFT JOIN question_options qo ON pa.option_id = qo.id
                 JOIN questions q ON pa.question_id = q.id
                 WHERE pa.profile_id = ? AND q.role = 'local' AND q.display_order = 1`,
                [local.id]
            );

            const localTags = new Set();
            const localOptionTitles = [];

            for (const row of laRows) {
                if (row.option_title) {
                    localOptionTitles.push(row.option_title);
                }
                if (row.trait_tags) {
                    row.trait_tags.split(",").map(t => t.trim()).filter(Boolean).forEach(t => localTags.add(t));
                }
            }

            const travellerTagsArray = Array.from(travellerTags);
            const localTagsArray = Array.from(localTags);

            let overlapCount = 0;
            const matchedTagValues = [];
            if (travellerTagsArray.length > 0 && localTagsArray.length > 0) {
                const localTagSet = new Set(localTagsArray);
                for (const t of travellerTagsArray) {
                    if (localTagSet.has(t)) {
                        overlapCount++;
                        matchedTagValues.push(t);
                    }
                }
            }

            const matchReason = matchedTagValues.length > 0
                ? `Matched on: ${matchedTagValues.join(", ")}`
                : localOptionTitles.length > 0
                    ? `Expertise: ${localOptionTitles.join(", ")}`
                    : "No matching expertise found";

            return {
                id: local.id,
                name: local.display_name,
                city: local.city,
                email: local.email,
                expertise: localOptionTitles,
                matchReason,
                score: overlapCount
            };
        }));

        scored.sort((a, b) => b.score - a.score);

        const result = scored.map(({ score, ...rest }) => rest);

        res.json({
            success: true,
            locals: result
        });

    } catch (error) {
        console.error("Error fetching locals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch locals."
        });
    }
});

app.post("/api/profile", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            email,
            role = "traveller",
            displayName,
            city,
            answers
        } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                message: "Profile answers are required."
            });
        }

        if (role === "local" && (!displayName || !String(displayName).trim())) {
            return res.status(400).json({
                success: false,
                message: "Display name is required for local profiles."
            });
        }

        await connection.beginTransaction();

        const [userResult] = await connection.query(
            `\n            INSERT INTO users (role, email)
            VALUES (?, ?)
            `,
            [role, email || null]
        );

        const userId = userResult.insertId;

        const [profileResult] = await connection.query(
            `\n            INSERT INTO profiles
                (user_id, display_name, city)
            VALUES (?, ?, ?)
            `,
            [userId, displayName || null, city || null]
        );

        const profileId = profileResult.insertId;

        for (const answer of answers) {
            const options = answer.options || [];

            for (const option of options) {
                await connection.query(
                    `\n                    INSERT INTO profile_answers
                        (profile_id, question_id, option_id, custom_text)
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        profileId,
                        answer.questionId,
                        option.optionId || null,
                        option.customText || null
                    ]
                );
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Profile saved successfully.",
            userId,
            profileId
        });

    } catch (error) {
        await connection.rollback();

        console.error("Error saving profile:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save profile."
        });

    } finally {
        connection.release();
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Belong backend running on http://localhost:${PORT}`);
});
