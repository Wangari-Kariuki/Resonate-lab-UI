require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("node:stream");

const app = express();

const upload = multer({
    storage: multer.memoryStorage()
});

app.use(cors());

const auth = new google.auth.GoogleAuth({
    keyFile: require("path").join(__dirname, "apikeys.json"),
    scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({
    version: "v3",
    auth
});

app.post("/api/audio", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No audio file uploaded"
            });
        }

        const driveResponse = await drive.files.create({
            requestBody: {
                name: req.file.originalname,
                mimeType: req.file.mimetype,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            },
            media: {
                mimeType: req.file.mimetype,
                body: Readable.from(req.file.buffer)
            },
            fields: "id,name,mimeType,parents,webViewLink"
        });

        res.status(201).json({
            message: "Audio uploaded to Google Drive successfully",
            file: driveResponse.data
        });
    } catch (error) {
        console.error("Google Drive upload failed:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});