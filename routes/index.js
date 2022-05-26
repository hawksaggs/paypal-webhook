var express = require("express");
var router = express.Router();
const axios = require("axios");
const qs = require("qs");
const res = require("express/lib/response");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

const login = async () => {
  try {
    const response = await axios({
      url: process.env.PAYPAL_API_URL + "/v1/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: qs.stringify({
        grant_type: "client_credentials",
      }),
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
    });

    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(400, "Please try again later");
  }
};

const verifySignature = async (access_token, data) => {
  try {
    const response = await axios({
      url:
        process.env.PAYPAL_API_URL +
        "/v1/notifications/verify-webhook-signature",
      method: "POST",
      headers: {
        Authorization: "Bearer " + access_token,
        "Content-Type": "application/json",
      },
      data,
    });

    // if(response.status !== 200) {
    //   console.log(response);
    //   throw new Error('Something went wrong!!');
    // }

    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error(400, "Please try again later");
  }
};

router.post("/webhook-events", async (req, res, next) => {
  try {
    console.log("headers: ", req.headers);
    console.log("body: ", req.body);

    // data from req header to verify paypal request signature
    const transmissionId = req.headers["paypal-transmission-id"];
    const transmissionSignature = req.headers["paypal-transmission-sig"];
    const transmissionTimestamp = req.headers["paypal-transmission-time"];
    const authAlgo = req.headers["paypal-auth-algo"];
    const certURL = req.headers["paypal-cert-url"];

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const eventBody = req.body;

    const { event_type, resource_type } = eventBody;

    if (resource_type !== "capture") return;

    const verifySigData = {
      auth_algo: authAlgo,
      cert_url: certURL,
      transmission_id: transmissionId,
      transmission_sig: transmissionSignature,
      transmission_time: transmissionTimestamp,
      webhook_id: webhookId,
      webhook_event: eventBody,
    };

    const { access_token } = await login();
    console.log("access_token: ", access_token);
    console.log("verifySigData: ", verifySigData);
    const { verification_status } = await verifySignature(
      access_token,
      verifySigData
    );

    console.log('verification status: ', verification_status);
    // if (verification_status !== "SUCCESS") {
    //   throw new Error("Something went wrong");
    // }

    switch (event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        console.log('Payment Completed');
        break;

      case "PAYMENT.CAPTURE.PENDING":
        console.log('Payment Pending');
        break;

      case "PAYMENT.CAPTURE.REVERSED":
        console.log('Payment Reversed');
        break;

      case "PAYMENT.CAPTURE.REFUNDED":
        console.log('Payment Refunded');
        break;

      case "PAYMENT.CAPTURE.DENIED":
        console.log('Payment Denied');
        break;
      default:
    }

    return res.status(200).json({});
  } catch (error) {
    console.error("paypalWebhookEvents: ", error);
  }
});

module.exports = router;
