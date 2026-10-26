import { render } from "./api";
test("render", () => { expect(render({invoice: "i1", amount: 1000, status: "charged"})).toBe("i1: 10.00 EUR"); });
