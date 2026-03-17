import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class Conversation extends Model {
  public ID!: number;
  public title!: string;
  public userId!: number;
}
Conversation.init(
  {
    ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "Conversation",
    tableName: "conversations",
    timestamps: true,
  }
);
