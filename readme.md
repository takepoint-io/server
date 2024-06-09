# Setup
This project requires Node.js and npm to run.<br>
Clone the repo and run `npm install`. Then, make sure to create a `config.json` in the project root as follows:
```json
{
    "dev": <boolean>,
    "APIUpdateFreq": <int seconds>,
    "APIUrl": <String || http://127.0.0.1:8080>,
    "port": <int || 8000>,
    "region": <String contintent>,
    "city": <String city>,
    "game_type": "3TEAM",
    "owner": null,
    "label": null,
    "url": <String || localhost:8000>,
    "capacity": <int capacity>,
    "short_id": null
}
```
Create a .env file with a `registerKey` that matches the one on your instance of the API. <br>
If you don't have one, use the format `registerKey="<someRandomString>"` and remember to set it on the API as well. <br>
After you've done all of the above, you should be good to go! Just run `node index.js`.

# Tests
To run automated tests, use `npm run test`.
