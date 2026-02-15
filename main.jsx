import React from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import MeebitQuiz from "./MeebitQuiz.jsx";

inject();

createRoot(document.getElementById("root")).render(
  React.createElement(MeebitQuiz)
);
