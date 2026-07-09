const db = require('./db');
const bcrypt = require('bcrypt');

const cars = [
    {
        make: "Tesla",
        model: "Model 3",
        price: "$39,000",
        type: "Sedan",
        powertrain: "Electric",
        features: JSON.stringify(["Autopilot", "Minimalist Interior", "Fast Charging"]),
        image: "images/tesla.png"
    },
    {
        make: "Ford",
        model: "Mustang Mach-E",
        price: "$43,000",
        type: "SUV",
        powertrain: "Electric",
        features: JSON.stringify(["Spacious", "Sporty Handling", "High Tech"]),
        image: "images/mustang.png"
    },
    {
        make: "Toyota",
        model: "Camry Hybrid",
        price: "$28,000",
        type: "Sedan",
        powertrain: "Hybrid",
        features: JSON.stringify(["Extremely Reliable", "Great MPG", "Comfortable"]),
        image: "images/camry.png"
    },
    {
        make: "Jeep",
        model: "Wrangler",
        price: "$35,000",
        type: "SUV",
        powertrain: "Gas",
        features: JSON.stringify(["Off-road King", "Convertible Top", "Rugged"]),
        image: "images/jeep.png"
    },
    {
        make: "Porsche",
        model: "911 Carrera",
        price: "$114,000",
        type: "Sports Car",
        powertrain: "Gas",
        features: JSON.stringify(["Extreme Performance", "Iconic Design", "Luxury"]),
        image: "images/porsche.png"
    },
    {
        make: "Honda",
        model: "CR-V",
        price: "$29,500",
        type: "SUV",
        powertrain: "Gas",
        features: JSON.stringify(["Family Friendly", "Cargo Space", "Safe"]),
        image: "images/honda.png"
    }
];

const seedData = async () => {
    console.log('Starting seeding process...');
    
    // Insert cars
    cars.forEach(car => {
        db.run(`INSERT INTO cars (make, model, price, type, powertrain, features, image) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [car.make, car.model, car.price, car.type, car.powertrain, car.features, car.image],
                function(err) {
                    if (err) {
                        return console.error('Error inserting car:', err.message);
                    }
                    console.log(`Car inserted: ${car.make} ${car.model}`);
                });
    });

    // Seed customer user
    const saltRounds = 10;
    const plainPassword = 'password123';
    try {
        const hash = await bcrypt.hash(plainPassword, saltRounds);
        db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, ['customer', hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    console.log('Customer user already exists.');
                } else {
                    console.error('Error inserting user:', err.message);
                }
            } else {
                console.log('Seeded user -> Username: customer, Password: password123');
            }
        });
    } catch(err) {
        console.error('Error hashing password:', err);
    }
    
    // Wait a bit to ensure async db operations finish before exiting
    setTimeout(() => {
        console.log('Seeding finished.');
    }, 1500);
};

seedData();
