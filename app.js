const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000);
  } catch (error) {
    console.log(`DB ERROR:${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//POST(User Login with token Authentication)
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
            SELECT
                *
            FROM
                user
            WHERE
                username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertDbObjToResObj = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};
const convertDistObjToResObj = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};

//GET(Returns a list of all states in the state table)
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
                *
            FROM
                state
    ;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachItem) => convertDbObjToResObj(eachItem)));
});

//GET(Returns a state based on the state ID)
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
            SELECT
                *
            FROM
                state
            WHERE
                state_id = ${stateId};
    
    `;
  const stateObj = await db.get(getStateQuery);
  response.send(convertDbObjToResObj(stateObj));
});

//POST(Create a district in the district table, district_id is auto-incremented)
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistQuery = `
            INSERT INTO
                district(district_name,state_id,cases,cured,active,deaths)
            VALUES(
                '${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active},
                ${deaths}
            );
    
    `;
  const dbResponse = await db.run(createDistQuery);
  response.send("District Successfully Added");
});

//GET(Returns a district based on the district ID)
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
            SELECT
                *
            FROM
                district
            WHERE
                district_id = ${districtId};
    `;
    const districtObj = await db.get(getDistrictQuery);
    response.send(convertDistObjToResObj(districtObj));
  }
);

//DELETE(Deletes a district from the district table based on the district ID)
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `
            DELETE FROM
                district
            WHERE
                district_id = ${districtId};
    `;
    const dbResponse = await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

//PUT(Updates the details of a specific district based on the district ID)
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistQuery = `
            UPDATE
                district
            SET
                district_name = '${districtName}',
                state_id = ${stateId},
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}
            WHERE
                district_id = ${districtId};
    
    `;

    const dbResponse = await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//GET(Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID)
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
            SELECT
                SUM(cases) AS totalCases,
                SUM(cured) AS totalCured,
                SUM(active) AS totalActive,
                SUM(deaths) AS totalDeaths
            FROM
                district
            WHERE
                state_id = ${stateId};
    
    `;
    const dbResponse = await db.get(statsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
