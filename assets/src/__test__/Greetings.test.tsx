import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Greetings } from "../components/Greetings";

describe("when rendered with a `name` prop", () => {
    it("should paste it into the greetings text", () => {
        render(<Greetings name="Test Name" />);
        expect(screen.getByText(/Test Name!/)).toBeInTheDocument();
    });
});
