const express = require('express');
const crypto = require('crypto'); //built in node too to generate IDs
const { getContainer } = require('./db');
const { ServiceBusClient } = require('@azure/service-bus');

const app = express();
const port = 3000;

// tells your API how to read incoming JSON data.
app.use(express.json());

//POST route to catch incoming predictions
app.post('/api/predictions', async (req, res) => {
    try {
        //req.body holds the JSON payload sent by the frontend
        const prediction = req.body;

        // Data Validation
        if (!prediction.userId || !prediction.eventId || prediction.predictedValue === undefined) {
            // if something missing, give 400 bad request error
            return res.status(400).json({
                error: "Validation failed: Missing userId, eventId, or predictedValue."
            });
        }

        const finalPredictionData = {
            id: crypto.randomUUID(),
            userId: prediction.userId,
            eventId: prediction.eventId,
            predictedValue: prediction.predictedValue,
            timeStamp: new Date().toISOString(),
            status: "active"
        };
        const container = await getContainer();
        const { resource: savedItem } = await container.items.create(finalPredictionData);
        console.log("Success! Saved prediction to Cosmos DB. ID:", savedItem.id);

        //notify the service bus
        const sbClient = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING);
        const sender = sbClient.createSender(process.env.QUEUE_NAME);

        //send message to queue
        await sender.sendMessages({
            body: { message: "New prediction ready for scoring!", predictionId: savedItem.id }
        });
        console.log("Success. Pinged scoring engine.")
        await sender.close();
        await sbClient.close();

        // send a 201 created status back to frontend so it knows it worked
        res.status(201).json({
            message: "Prediction safely saved in the database!",
            savedData: savedItem
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({error:"Failed to save prediction to the database."});
    }
});

// This tells the server to turn on and start listening
app.listen(port, () => {
  console.log(`Server is awake! Listening on http://localhost:${port}`);
});