
Dependences:
- npm install express
- node (probably)
- Go to VSCode Extension and install Thunder Client

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
Using it to make sure the API works and is able to read and take new data.

Next Steps:
- Connect API to Cosmos Database
- Be careful of any costs occurring