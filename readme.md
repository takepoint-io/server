# Setup
This project requires Node.js and npm to run.<br>
Clone the repo and run `npm install`. Then, make sure to create a `config.json` in the project root as follows:
```js
{
    "updateTimer": [int],
    "dev": [boolean || false],
    "port": [int || 8000],
    //should be set to true unless you know what you're doing
    "override": [boolean || false],
    "capacity": [int],
    //region, city, and url are only effective when override is enabled
    "region": [String],
    "city": [String],
    //you can keep this empty if running locally
    "url": [String],
}
```
Then, create a .env file with an `APIUrl` and a `registerKey` that matches the one on your instance of the API. <br>
For example: <br>
```env
registerKey="e9QxsrlQUW3DM8SJTWH3BT7WgycOhvA12DvE2eHzVAPku72HSwjk5gpit33B1Y5"
APIUrl="http://localhost:8080"
```
After you've done all of the above, you should be good to go! Just run `node index.js`.

# Tests
To run automated tests, use `npm run test`.
