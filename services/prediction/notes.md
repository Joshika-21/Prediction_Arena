
## Instructions to test the API and Azure Cosmos Database
- Please ask the backend dev 1 for all the keys.

### Dependences:
- node (if you don't already have, look it up)

Type in the Terminal
- npm install express
- Go to VSCode Extension and install Thunder Client
- npm install @azure/cosmos dotenv
- npm install @azure/service-bus

To run prediction service:
- Go to services/prediction by typing

        cd services/prediction
        node index.js

- Open Thunder Client(acts as a frontend for now) in sidebar
- Select New Request
- Change dropdown from GET to POST
- Replace url with http://localhost:3000/api/predictions
- Select body, then select JSON, and add this code to the body

        {
        "userId": "user_10485",         
        "eventId": "event_superbowl_26", 
        "predictedValue": 0.75
        }
- Click Send

Thunder Client simply acts as a frontend service for now, but will be replaced by React frontend.
