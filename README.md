# Jal-Mitra

A lightweight single-page web application for Gram Panchayat water
operation & maintenance monitoring. Designed as a final-year B.Tech CSE
project with a `Jal Jeevan Mission` theme.

## Features

- Dashboard overview of system health (pump status, water quality, faults)
- Daily O&M log entry with pump hours, meter readings, and leakage checks
- Water quality portal for recording pH, chlorine, and optional TDS
- Fault reporting and tracking with status updates
- Analytics page showing pump efficiency and water quality trends
- Anonymous Firebase authentication and Firestore backend (config
depends on environment)

Everything is written in vanilla ES modules and Tailwind CSS; there is no
build step or dependency manager.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/PAYALTIWARI11/Jal_Mitra.git
   cd "Jal Mitra"
   ```

2. **Serve the files**
   Any static file server will do. Examples:

   - Using Node:
     ```bash
     npx http-server -c-1
     ```
   - Using Python 3:
     ```bash
     python -m http.server 8000
     ```

   Then open a browser at `http://localhost:8080` (or the port shown).

3. **Firebase configuration**
   The app expects configuration and optional auth tokens to be injected by
the hosting environment. For local testing you can set global variables
in `index.html` or modify `app.js`/`indexe.html` accordingly.

4. **Development**
   - Edit the `.js` files and reload the page to see changes.
   - Authentication failures fall back to an ephemeral `development-fallback`
     user; data will not persist in Firebase.

## Project Structure

```
app.js          # Main application logic & Firebase interactions
components.js   # UI templates and utility functions
index.html      # Primary single-page entry point
indexe.html     # Alternate/legacy copy used during early development
favicon.ico     # Tiny icon to suppress 404 requests
README.md       # This file
```

## GitHub

Repository: https://github.com/PAYALTIWARI11/Jal_Mitra

Feel free to open issues, submit PRs, or fork for your own improvements.

## License

This project is released under the MIT License. See `LICENSE` for details.