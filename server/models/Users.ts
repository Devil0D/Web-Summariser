import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

//Authenticating Database Connected
sequelize.authenticate().then(() => {
  console.log("Database connected");
});
export class User extends Model {
  public ID!: number;
  public Username!: string;
  public Email!: string;
  public Password!: string;
  public tokens!: string | null;
  public google_id!: string | null;
  public facebook_id!: string | null;

}

User.init(
  {
    ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    Username: { type: DataTypes.STRING, unique: true, allowNull: false },
    Email: { type: DataTypes.STRING, unique: true, allowNull: false },
    Password: { type: DataTypes.STRING, allowNull: false },
    tokens: { type: DataTypes.TEXT, allowNull: true },
    google_id: { type: DataTypes.STRING, unique: true, allowNull: true },
    facebook_id: { type: DataTypes.STRING, unique: true, allowNull: true },
  },
  { sequelize, modelName: "User", tableName: "users", timestamps: true }
);
