import { Sequelize } from "sequelize";
import * as dotenv from "dotenv";
dotenv.config();

// database file connecting to node application
export const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASS!,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: console.log,
  }
);
