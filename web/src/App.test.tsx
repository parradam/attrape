import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(cleanup);

test("shows the Inbox heading", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
});
