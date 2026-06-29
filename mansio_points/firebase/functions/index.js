const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const apiManager = require("./api_manager");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { pipeline } = require("node:stream/promises");

setGlobalOptions({ region: "us-central1" });

exports.mansiopointapp = functions
  .runWith({ minInstances: 1, maxInstances: 4, timeoutSeconds: 120 })
  .https.onCall(async (data, context) => {
    try {
      console.log(`Making API call for ${data["callName"]}`);
      var response = await apiManager.makeApiCall(context, data);
      console.log(`Done making API Call! Status: ${response.statusCode}`);
      return response;
    } catch (err) {
      console.error(`Error performing API call: ${err}`);
      return {
        statusCode: 400,
        error: `${err}`,
      };
    }
  });

async function verifyAuthHeader(request) {
  const authorization = request.header("authorization");
  if (!authorization) {
    return null;
  }
  const idToken = authorization.includes("Bearer ")
    ? authorization.split("Bearer ")[1]
    : null;
  if (!idToken) {
    return null;
  }
  try {
    const authResult = await admin.auth().verifyIdToken(idToken);
    return authResult;
  } catch (err) {
    return null;
  }
}

function setCorsHeaders(req, res) {
  const origin = req.header("origin");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Vary", "Origin");
  } else {
    res.set("Access-Control-Allow-Origin", "*");
  }

  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    req.header("access-control-request-headers") ||
      "authorization, content-type",
  );
}

exports.mansiopointappV2 = onRequest(
  { minInstances: 1, maxInstances: 4, timeoutSeconds: 120 },
  async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const context = {
        auth: await verifyAuthHeader(req),
      };
      const data = req.body.data;
      console.log(`Making API call for ${data["callName"]}`);
      var endpointResponse = await apiManager.makeApiCall(context, data);
      console.log(
        `Done making API Call! Status: ${endpointResponse.statusCode}`,
      );
      res.set(endpointResponse.headers);
      setCorsHeaders(req, res);
      res.status(endpointResponse.statusCode);
      await pipeline(endpointResponse.body, res);
    } catch (err) {
      console.error(`Error performing API call: ${err}`);
      setCorsHeaders(req, res);
      res.status(400).send(`${err}`);
    }
  },
);
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  let firestore = admin.firestore();
  let userRef = firestore.doc("user/" + user.uid);
});
