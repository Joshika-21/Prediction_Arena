const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

// create Client
async function getContainer() {
    if (!endpoint || !key) {
        throw new Error("Missing COSMOS_ENDPOINT or COSMOS_KEY in environment.");
    }

    //look for db called 'AreaDB', if not exist, then create it
    const { database } = await client.databases.createIfNotExists({ id: "ArenaDB" });

    //inside the db, look for container called "Predictions"
    const { container } =  await database.containers.createIfNotExists({
        id: "Predictions",
        partitionKey: { paths: ["/eventId"] }
    });
    console.log("Connected to Cosmos DB!")
    return container;
}
module.exports = { getContainer };