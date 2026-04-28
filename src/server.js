const app = require("./app");
const config = require("./config");

app.listen(config.port, () => {
  console.log(`HabitPulse is running on http://localhost:${config.port}`);
});
