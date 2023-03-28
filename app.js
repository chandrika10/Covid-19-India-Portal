const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running");
    });
  } catch (e) {
    console.log("DBError:${e.message}");
    process.exit(1);
  }
};

initializeDBAndServer();
//login API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT *
                          FROM user
                          WHERE username = '${username}'`;
  const user = await db.get(getUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "drfjgeaifnvjf");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//GET state API 2
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "drfjgeaifnvjf", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
        request.username = payload.username;
      }
    });
  }
};
const convertDBObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/", authentication, async (request, response) => {
  const getSateQuery = `SELECT *
                          FROM state`;
  const result = await db.all(getSateQuery);
  response.send(
    result.map((eachPlayer) => convertDBObjectToResponseObject(eachPlayer))
  );
});

//API 3

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT *
                          FROM state
                          WHERE state_id = ${stateId}`;
  const result = await db.get(getStateQuery);
  response.send(convertDBObjectToResponseObject(result));
});

//API 4
app.post("/districts/", authentication, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `INSERT INTO
                              district(district_name,state_id,cases,cured,active,deaths)
                              values('${districtName}',
                                       ${stateId},
                                       ${cases},
                                       ${cured},
                                       ${active},
                                       ${deaths})`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
const convertDBObjectToResponseObjects = (dbObject) => {
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
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT *
                          FROM  district
                          WHERE district_id = ${districtId}`;
    const result = await db.get(getDistrictQuery);
    response.send(convertDBObjectToResponseObjects(result));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `DELETE FROM
                                district
                                WHERE district_id = ${districtId}`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const upDateDistrict = `UPDATE  district
                               SET district_name = '${districtName}',
                                   state_id = ${stateId},
                                   cases = ${cases},
                                   cured = ${cured},
                                   active = ${active},
                                   deaths = ${deaths}
                                   WHERE district_id = ${districtId}`;
    await db.run(upDateDistrict);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `SELECT 
                            SUM(cases),
                            SUM(cured),
                            SUM(active),
                            SUM(deaths)
                          FROM District
                          WHERE state_id = ${stateId}`;
    const stats = await db.get(getStateQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
