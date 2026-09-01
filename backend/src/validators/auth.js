const { validate, expectValid, str } = require("./common");

function loginBody(body) {
  const errors = validate(body, {
    email: { required: true, type: "string", max: 190 },
    password: { required: true, type: "string", max: 190 }
  });
  expectValid(errors);
  return { email: str(body.email).toLowerCase(), password: body.password };
}

function adminUserBody(body) {
  const errors = validate(body, {
    name: { required: true, type: "string", max: 190 },
    email: { required: true, type: "string", max: 190 },
    role: { required: true, type: "string", oneOf: ["super_admin", "admin", "finance", "moderator", "support"] },
    password: { type: "string", max: 190 }
  });
  expectValid(errors);
  return {
    name: str(body.name),
    email: str(body.email).toLowerCase(),
    role: body.role,
    password: body.password
  };
}

module.exports = { loginBody, adminUserBody };