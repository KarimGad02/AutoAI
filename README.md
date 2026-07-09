# AutoAI

AutoAI is a web application that manages users, sessions, and a car catalogue using Express and SQLite.

## Features

- **Authentication**: Users can login and logout securely using session management and bcrypt for password hashing.
- **Cars Directory**: Retrieve all available cars or fetch a specific car's details.
- **Checkout**: Authenticated users can place an order for a specific car with their delivery address.
- **Database setup**: Uses SQLite for data storage, simplifying local setup.

## Getting Started

### Prerequisites
- Node.js (v14 or above)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize the database and run the seed script:
   ```bash
   node seed.js
   ```

4. Start the server:
   ```bash
   node server.js
   ```

The application will run on `http://localhost:3000`.

## API Endpoints
- `GET /api/auth/me` - Get current user session
- `POST /api/auth/login` - Login to the system
- `POST /api/auth/logout` - Logout of the system
- `GET /api/cars` - Fetch all cars
- `GET /api/cars/:id` - Fetch specific car details
- `POST /api/checkout` - Checkout process for authenticated users

## License
ISC
