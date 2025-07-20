const { localize } = require("../utils/localization.utils");
const { ValidationError, ServiceError } = require("../infra/errors");
const dbHandler = require("../utils/db-handler.utils");
const knownLocationModel = require("../models/knownlocation.model");

const knownLocationHandler = dbHandler(knownLocationModel);

/**
 * @swagger
 * /v1/utils/cep:
 *   get:
 *     summary: Get address by CEP
 *     description: Retrieve address information from Brazilian postal code (CEP)
 *     tags: [Utils]
 *     parameters:
 *       - in: query
 *         name: cep
 *         required: true
 *         schema:
 *           type: string
 *         description: Brazilian postal code (CEP)
 *         example: "01310-100"
 *     responses:
 *       200:
 *         description: Address information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cep:
 *                   type: string
 *                   example: "01310-100"
 *                 logradouro:
 *                   type: string
 *                   example: "Avenida Paulista"
 *                 complemento:
 *                   type: string
 *                   example: ""
 *                 bairro:
 *                   type: string
 *                   example: "Bela Vista"
 *                 localidade:
 *                   type: string
 *                   example: "São Paulo"
 *                 uf:
 *                   type: string
 *                   example: "SP"
 *                 ibge:
 *                   type: string
 *                   example: "3550308"
 *                 gia:
 *                   type: string
 *                   example: "1004"
 *                 ddd:
 *                   type: string
 *                   example: "11"
 *                 siafi:
 *                   type: string
 *                   example: "7107"
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid CEP format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: CEP not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

    delete responseBody.location;
    responseBody.updated_at = updatedAt;

    return res.status(200).json(responseBody);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /v1/utils/coordinates:
 *   get:
 *     summary: Get coordinates by address
 *     description: Retrieve geographic coordinates from address information
 *     tags: [Utils]
 *     parameters:
 *       - in: query
 *         name: street
 *         required: true
 *         schema:
 *           type: string
 *         description: Street name
 *         example: "Avenida Paulista"
 *       - in: query
 *         name: number
 *         required: true
 *         schema:
 *           type: string
 *         description: Street number
 *         example: "1000"
 *       - in: query
 *         name: neighborhood
 *         required: true
 *         schema:
 *           type: string
 *         description: Neighborhood
 *         example: "Bela Vista"
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *         description: City name
 *         example: "São Paulo"
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State abbreviation
 *         example: "SP"
 *       - in: query
 *         name: zipcode
 *         required: true
 *         schema:
 *           type: string
 *         description: ZIP code
 *         example: "01310-100"
 *     responses:
 *       200:
 *         description: Coordinates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lat:
 *                   type: number
 *                   example: -23.5505
 *                 lng:
 *                   type: number
 *                   example: -46.6333
 *       400:
 *         description: Invalid address format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Address not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getCoordinates(req, res, next) {
  try {
    const { street, neighborhood, city, state, zipcode, number } = req.query;

    if (!street) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "street" }),
      });
    }

    if (!neighborhood) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "neighborhood" }),
      });
    }

    if (!city) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "city" }),
      });
    }

    if (!state) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "state" }),
      });
    }

    if (!zipcode) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "zipcode" }),
      });
    }

    if (!number) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "number" }),
      });
    }

    const address = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, ${zipcode}`;

    // We need to check on database if the address is already geocoded
    // This way we can save the address generated by the getCEP and reuse
    // To save requests to the Google Maps API
    const knownLocation = await knownLocationHandler.read({
      filter: {
        "address.zipcode": zipcode.replace("-", ""),
        "address.number": parseInt(number, 10),
      },
    });

    if (knownLocation) {
      return res.status(200).json({
        address,
        latitude: knownLocation.address.location.coordinates[1],
        longitude: knownLocation.address.location.coordinates[0],
        cached: true,
      });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    );
    const addressData = await response.json();

    if (response.status !== 200) {
      throw new ServiceError({
        message: "Erro ao recuperar coordenadas do endereço",
        cause: addressData.error_message || addressData,
      });
    }

    if (addressData.results.length === 0) {
      console.log(`addressData.status: ${addressData.status}`);
      throw new ServiceError({
        message: localize("error.utils.coordinates.cause"),
        action: localize("error.utils.coordinates.action"),
      });
    }
    const coordinates = addressData.results[0]?.geometry?.location;

    if (!coordinates) {
      throw new ServiceError({
        message: localize("error.utils.coordinates.cause"),
        action: localize("error.utils.coordinates.action"),
      });
    }

    // Save new known location
    const newKnownLocationOptions = {
      data: {
        address: {
          street: street,
          neighborhood: neighborhood,
          city: city,
          state: state,
          zipcode: zipcode.replace("-", ""),
          number: parseInt(number, 10),
          location: {
            type: "Point",
            coordinates: [coordinates.lng, coordinates.lat],
          },
        },
      },
    };

    await knownLocationHandler.create(newKnownLocationOptions);

    return res.status(200).json({
      address,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCEP,
  getCoordinates,
};
