import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class Folder extends Model {
  public ID!: number;
  public Folder_Name!: string;
  public User_ID!: number;
}

Folder.init(
  {
    ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    Folder_Name: { type: DataTypes.STRING, allowNull: false },
    User_ID: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: "Folder", tableName: "uploads", timestamps: true }
);
