# Patreon Tier Verification Gate (PRO+ Edition)

A fully integrated Node.js authentication gateway utilizing **Express**, **Express-Session**, and the **Patreon API v2** via OAuth2. 

This repository includes a fully built, interactive **Vanilla Client PRO+ Dashboard** featuring 11 advanced utilities for Minecraft server administration, command generation, and data translation. The dashboard is dynamically served only to users who successfully authenticate and hold the required Patreon membership tier.

## 🚀 Features

* **OAuth2 Flow:** Secure, direct integration with Patreon's authentication servers.
* **Tier Verification:** Dynamic validation of a user's `currently_entitled_tiers` to gate content.
* **Session Management:** Secure cookie handling to keep verified users logged in.
* **Fast and Reliable:** A quick way to access patreon!
  
## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Dependencies:** `axios`, `dotenv`, `express-session`
* **Frontend (Dashboard):** HTML5, CSS3 (CSS Variables, Flexbox/Grid), Vanilla JavaScript

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/patreon-verification-portal.git
    cd patreon-verification-portal
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    * Rename the included `.env.example` file to `.env` (or create a new `.env` file).
    * Obtain your API credentials from the [Patreon Developer Portal](https://www.patreon.com/portal/registration).
    * Update the `.env` file with your specific variables:
        ```env
        PATREON_CLIENT_ID=your_client_id_here
        PATREON_CLIENT_SECRET=your_client_secret_here
        REDIRECT_URI=http://localhost:3000/oauth/callback 
        SESSION_SECRET=a_long_random_string_for_cookie_encryption
        REQUIRED_TIER_ID=your_numerical_tier_id_here
        ```
        *Note: Ensure your `REDIRECT_URI` exactly matches the URI registered in your Patreon Developer Dashboard.*

4.  **Start the Server:**
    ```bash
    npm start
    ```

5.  **Access the Portal:**
    Open your browser and navigate to `http://localhost:3000`. 

## ⚠️ Important Production Notes

* **Session Storage:** By default, this application uses Express's `MemoryStore` for sessions. This is suitable for development and low-traffic environments. For production deployments (e.g., Heroku, Render), it is highly recommended to implement a persistent session store like `connect-mongo` or `connect-redis` to prevent users from being logged out when the server restarts.
* **Security:** Never commit your `.env` file to version control. Ensure it remains listed in your `.gitignore`.

## 📄 License

This project is licensed under the MIT License.
