const { AppError } = require("../utils/AppError");
const { validate, expectValid } = require("./common");

// createRules: professionalId comes from the route param; body carries
// rating + comment. Rating MUST be an integer 1–5 (req 21/27).
const createRules = {
  professionalId: { type: "string", required: true, opaqueId: true },
  rating: { type: "number", required: true },
  comment: { type: "string", max: 2000 }
};

function assertRating(rating) {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new AppError("La note doit être un entier entre 1 et 5.", 400);
  }
}

function reviewCreate(data) {
  expectValid(validate(data, createRules));
  assertRating(data.rating);
}

function reviewUpdate(data) {
  expectValid(validate(data, {
    rating: { type: "number" },
    comment: { type: "string", max: 2000 }
  }));
  if (data.rating !== undefined) assertRating(data.rating);
}

module.exports = { reviewCreate, reviewUpdate };
