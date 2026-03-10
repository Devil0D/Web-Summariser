import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

sequelize.authenticate().then(() => {
  console.log("Message Database connected");
});

export class Message extends Model {
  public ID!: number;
  public conversationId!: number;
  public userId!: number;
  public role!: "user" | "model";
  public content!: string;
}

Message.init(
  {
    ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT("long"), allowNull: false },
  },
  { sequelize, modelName: "Message", tableName: "messages", timestamps: true }
);
