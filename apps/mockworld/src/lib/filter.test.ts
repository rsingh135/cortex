import { describe, expect, it } from "vitest";
import type { Listing } from "@cortex/schema";
import { applyFilter, facets, parseFilter } from "./filter";

const base: Omit<Listing, "_id" | "price" | "neighborhood" | "train"> = {
  hunt: "hunt1",
  title: "t",
  floor: 2,
  elevator: false,
  laundry: true,
  pets: false,
  walkup_floor: 2,
  photos: [],
  landlord: "Dana",
  description: "",
};
const listings: Listing[] = [
  { ...base, _id: "listing:1", price: 2600, neighborhood: "Bushwick", train: "L" },
  { ...base, _id: "listing:2", price: 3100, neighborhood: "Astoria", train: "N", hunt: "pool" },
  { ...base, _id: "listing:3", price: 2400, neighborhood: "Williamsburg", train: "L", hunt: "hunt2" },
];

describe("parseFilter", () => {
  it("reads valid params and ignores junk", () => {
    expect(parseFilter({ max_price: "2800", neighborhood: "Bushwick", train: "L", hunt: "hunt1" })).toEqual({ max_price: 2800, neighborhood: "Bushwick", train: "L", hunt: "hunt1" });
    expect(parseFilter({ max_price: "abc", hunt: "nope", neighborhood: "" })).toEqual({});
    expect(parseFilter({ max_price: ["2500", "9"] })).toEqual({ max_price: 2500 });
  });
});

describe("applyFilter", () => {
  it("filters by price, neighborhood, train, hunt", () => {
    expect(applyFilter(listings, { max_price: 2800 }).map((l) => l._id)).toEqual(["listing:1", "listing:3"]);
    expect(applyFilter(listings, { train: "l" }).map((l) => l._id)).toEqual(["listing:1", "listing:3"]);
    expect(applyFilter(listings, { neighborhood: "astoria" }).map((l) => l._id)).toEqual(["listing:2"]);
    expect(applyFilter(listings, { hunt: "hunt2" }).map((l) => l._id)).toEqual(["listing:3"]);
    expect(applyFilter(listings, {})).toHaveLength(3);
  });
  it("facets are sorted and distinct", () => {
    expect(facets(listings)).toEqual({ neighborhoods: ["Astoria", "Bushwick", "Williamsburg"], trains: ["L", "N"] });
  });
});
