const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

let db = null;

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (error) {
    console.log(console.error.message);
    process.exit(1);
  }
};

initializeDbServer();

const convertDistrictObject = (DbObject) => {
  return {
    districtId: DbObject.district_id,
    districtName: DbObject.district_name,
    stateId: DbObject.state_id,
    cases: DbObject.cases,
    cured: DbObject.cured,
    active: DbObject.active,
    deaths: DbObject.deaths,
  };
};

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
        response.send("Invalid Access Token");
      } else {
        next();
      }
    });
  }
};

const convertStateObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertStateIdObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//User Login Api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const loginUser = await db.get(selectUserQuery);

  if (loginUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, loginUser.password);
    if (comparePassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      // response.send("Login success!");
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStateQuery = `
    SELECT * FROM state;`;
  const state = await db.all(getStateQuery);
  const getState = state.map((eachItem) => {
    return convertStateObject(eachItem);
  });
  response.send(getState);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getState);
  response.send(convertStateIdObject(state));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;
  await db.run(addDistrict);
  response.send("District Successfully Added");
});

//API 5
const convertDistrictIdObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId};`;
    const district = await db.get(getDistrict);
    response.send(convertDistrictIdObject(district));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM district WHERE district_id =${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

//API 7
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
    const putDistrict = `UPDATE district
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id =${districtId};`;
    await db.run(putDistrict);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotals = `
    SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM 
    district
    WHERE state_id = ${stateId};`;
    const states = await db.get(getTotals);
    response.send(states);
  }
);

module.exports = app;
