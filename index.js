const express = require("express");
const session = require("express-session");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "change-this-to-a-secure-random-string",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  })
);

// 1. Home Page / Landing Page
app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Creator Premium Portal</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fafafa; color: #333; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 100%; }
                h1 { color: #111; font-size: 24px; margin-bottom: 10px; }
                p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 30px; }
                .btn-patreon { display: inline-block; background-color: #ff424d; color: white; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; transition: background 0.2s ease; font-size: 15px; }
                .btn-patreon:hover { background-color: #e3353f; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Exclusive Pro Portal 🔒</h1>
                <p>Welcome! This area contains premium content. Please log in with your Patreon account to verify your active subscription tier.</p>
                <a href="/login" class="btn-patreon">Log in with Patreon</a>
            </div>
        </body>
        </html>
    `);
});

// 2. Redirect User to Patreon OAuth2 Authorization Screen
app.get("/login", (req, res) => {
  if (!process.env.PATREON_CLIENT_ID || !process.env.REDIRECT_URI) {
    return res
      .status(500)
      .send(
        "Configuration Error: Missing PATREON_CLIENT_ID or REDIRECT_URI in .env file."
      );
  }

  const patreonAuthUrl =
    `https://www.patreon.com/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.PATREON_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
    `&scope=identity%20identity.memberships`;

  res.redirect(patreonAuthUrl);
});

// 3. OAuth2 Callback Endpoint (Processes the login token and handles verification)
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .send("Authorization code missing from Patreon callback.");
  }

  try {
    // Exchange the temporary code parameter for a permanent access token
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code: code,
          client_id: process.env.PATREON_CLIENT_ID,
          client_secret: process.env.PATREON_CLIENT_SECRET,
          redirect_uri: process.env.REDIRECT_URI,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch the user data and their currently active membership tiers
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          include: "memberships.currently_entitled_tiers",
          "fields[member]": "patron_status",
        },
      }
    );

    const userData = userResponse.data;
    const memberships = userData.included || [];
    let hasAccess = false;

    // Loop through memberships to see if they are active and belong to the correct tier ID
    memberships.forEach((member) => {
      if (
        member.type === "member" &&
        member.attributes.patron_status === "active_patron"
      ) {
        const tiers =
          member.relationships?.currently_entitled_tiers?.data || [];
        const matchesTier = tiers.some(
          (tier) => tier.id === process.env.REQUIRED_TIER_ID
        );
        if (matchesTier) {
          hasAccess = true;
        }
      }
    });

    if (hasAccess) {
      // Store authorization status in user session variables
      req.session.isPremium = true;
      res.redirect("/premium");
    } else {
      res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Access Denied</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fafafa; color: #333; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 450px; width: 100%; }
                        h1 { color: #d9534f; font-size: 24px; margin-bottom: 10px; }
                        p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 25px; }
                        .btn-home { display: inline-block; color: #666; text-decoration: underline; font-size: 14px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Access Denied 🔒</h1>
                        <p>Your Patreon account connected successfully, but you are not actively subscribed to the specific tier required to view this page.</p>
                        <p>Please double check your active subscription on Patreon and try logging in again.</p>
                        <a href="/" class="btn-home">Return to Homepage</a>
                    </div>
                </body>
                </html>
            `);
    }
  } catch (error) {
    console.error(
      "Patreon Auth Error Details:",
      error.response?.data || error.message
    );
    res
      .status(500)
      .send("Authentication process failed. Check server logs for details.");
  }
});

// 4. Premium Protected Content Page Route
app.get("/premium", (req, res) => {
  if (req.session.isPremium) {
    res.send(`
   Test // this is your test html page for members
        `);
  } else {
    res.status(403).send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
                <h2>Unauthorized Access</h2>
                <p>You must log in to view this page. <a href="/login">Click here to log in</a>.</p>
            </div>
        `);
  }
});

app.listen(PORT, () =>
  console.log(`Server successfully started! Running on port ${PORT}`)
);
