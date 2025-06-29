const { localize } = require("../utils/localization.utils");
const { ValidationError, ServiceError } = require("../infra/errors");

async function getCEP(req, res, next) {
  try {
    const { cep } = req.query;

    if (!cep) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "CEP" }),
      });
    }

    const updatedAt = new Date().toISOString();
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);

    // Check if the response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new ServiceError({
        message: localize("error.utils.cep.service"),
        cause: response,
      });
    }

    const responseBody = await response.json();

    // Handle v2 API error structure
    if (response.status === 404 || responseBody.name === "CepPromiseError") {
      throw new ServiceError({
        message: responseBody.message || localize("error.utils.cep.cause"),
        cause: responseBody.errors || responseBody,
        action: localize("error.utils.cep.action"),
      });
    }

    responseBody.updated_at = updatedAt;

    return res.status(200).json(responseBody);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCEP,
};
