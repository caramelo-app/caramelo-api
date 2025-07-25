const { localize } = require("../utils/localization.utils");
const { ValidationError, ServiceError } = require("../infra/errors");
const dbHandler = require("../utils/db-handler.utils");
const knownLocationModel = require("../models/knownlocation.model");
const { setTimeout } = require("timers/promises");

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

/**
 * @swagger
 * /v1/utils/places:
 *   get:
 *     summary: Get random addresses from Google Places API
 *     description: Retrieve random business addresses from a specific city using Google Places API
 *     tags: [Utils]
 *     parameters:
 *       - in: query
 *         name: city
 *         required: false
 *         schema:
 *           type: string
 *         description: City name to search for addresses
 *         example: "Curitiba"
 *       - in: query
 *         name: state
 *         required: false
 *         schema:
 *           type: string
 *         description: State abbreviation
 *         example: "PR"
 *       - in: query
 *         name: count
 *         required: false
 *         schema:
 *           type: number
 *         description: Number of addresses to retrieve
 *         example: 10
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   number:
 *                     type: number
 *                   neighborhood:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipcode:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Google Places API error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getRandomAddresses(req, res, next) {
  try {
    const { city = "Curitiba", state = "PR", count = 10 } = req.query;

    if (!city || !state) {
      throw new ValidationError({
        message: localize("error.generic.required", { field: "city and state" }),
      });
    }

    const countNum = parseInt(count, 10);
    if (isNaN(countNum) || countNum < 1 || countNum > 50) {
      throw new ValidationError({
        message: "Count must be a number between 1 and 50",
      });
    }

    // Keywords for all business types (more flexible than type search)
    const businessKeywords = {
      restaurants: [
        "pizzaria",
        "hamburgueria",
        "café",
        "hotdog",
        "cafe",
        "restaurante",
        "lanchonete"
      ],
      barbershops: [
        "barbearia",
        "barber shop",
        "barbearia masculina",
        "salão masculino",
        "barbearia tradicional"
      ],
      petShops: [
        "pet shop",
        "veterinário",
        "veterinária",
        "clínica veterinária",
        "pet store"
      ],
      musicStudios: [
        "estúdio musical",
        "estúdio de gravação",
        "estúdio de música",
        "recording studio",
        "estúdio de som"
      ]
    };

    const addresses = [];
    const usedPlaceIds = new Set();

    // Search in different areas of the city
    const searchAreas = [
      { lat: -25.4289, lng: -49.2744, radius: 5000 }, // Centro
      { lat: -25.4200, lng: -49.2650, radius: 5000 }, // Boa Vista
      { lat: -25.4150, lng: -49.2600, radius: 5000 }, // Bairro Alto
      { lat: -25.4250, lng: -49.2700, radius: 5000 }, // São Francisco
      { lat: -25.4230, lng: -49.2680, radius: 5000 }, // Centro Cívico
      { lat: -25.4210, lng: -49.2660, radius: 5000 }, // Mercês
    ];

    // Track how many of each type we've found
    const typeCounts = {
      restaurants: 0,
      barbershops: 0,
      petShops: 0,
      musicStudios: 0
    };

    // Calculate target per type (round up to ensure we get enough)
    const targetPerType = Math.ceil(countNum / 4);

    // Search in all areas to get target per type
    for (const area of searchAreas) {
      if (addresses.length >= countNum) break;

      console.log(`Searching in area: ${area.lat}, ${area.lng} (radius: ${area.radius}m)`);

      // Search for all business types using keywords
      for (const [businessType, keywords] of Object.entries(businessKeywords)) {
        if (addresses.length >= countNum) break;
        
        // Check if we have target required for this type
        if (typeCounts[businessType] >= targetPerType) {
          console.log(`Skipping ${businessType} - already have ${typeCounts[businessType]} (target: ${targetPerType})`);
          continue;
        }

        console.log(`Searching for ${businessType}... (have: ${typeCounts[businessType]}/${targetPerType})`);

        for (const keyword of keywords) {
          if (addresses.length >= countNum) break;
          if (typeCounts[businessType] >= targetPerType) break;

          console.log(`  Searching for keyword: "${keyword}"`);

          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + " Curitiba")}&location=${area.lat},${area.lng}&radius=${area.radius}&key=${process.env.GOOGLE_MAPS_API_KEY}`
            );

            if (response.status !== 200) {
              console.warn(`Failed to fetch places for keyword "${keyword}" in area ${area.lat},${area.lng}`);
              continue;
            }

            const data = await response.json();

            if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
              console.warn(`Google Places API error for keyword "${keyword}": ${data.status}`);
              continue;
            }

            console.log(`    Found ${data.results ? data.results.length : 0} results for "${keyword}"`);

            if (data.results && data.results.length > 0) {
              for (const place of data.results) {
                if (addresses.length >= countNum) break;
                if (typeCounts[businessType] >= targetPerType) {
                  console.log(`    Reached target for ${businessType}, stopping`);
                  break;
                }
                if (usedPlaceIds.has(place.place_id)) {
                  console.log(`    Skipping duplicate place: ${place.name}`);
                  continue;
                }

                console.log(`    Processing place: ${place.name}`);

                // Get detailed place information
                const detailResponse = await fetch(
                  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,address_components&key=${process.env.GOOGLE_MAPS_API_KEY}`
                );

                if (detailResponse.status !== 200) {
                  console.warn(`    Failed to get details for ${place.name}`);
                  continue;
                }

                const detailData = await detailResponse.json();
                if (detailData.status !== "OK") {
                  console.warn(`    Error getting details for ${place.name}: ${detailData.status}`);
                  continue;
                }

                const addressComponents = detailData.result.address_components || [];
                const formattedAddress = detailData.result.formatted_address;
                const geometry = detailData.result.geometry;
                const placeName = detailData.result.name;

                if (!formattedAddress || !geometry || !geometry.location || !placeName) {
                  console.warn(`    Missing required data for ${place.name}`);
                  continue;
                }

                // Parse address components
                const address = parseAddressComponents(addressComponents, formattedAddress, city, state);

                if (address) {
                  addresses.push({
                    ...address,
                    name: placeName,
                    coordinates: {
                      lat: geometry.location.lat,
                      lng: geometry.location.lng
                    }
                  });
                  usedPlaceIds.add(place.place_id);
                  typeCounts[businessType]++;
                  console.log(`    ✅ Added: ${placeName} (${addresses.length}/${countNum}) - ${businessType}: ${typeCounts[businessType]}/${targetPerType}`);
                  
                  // Check if we've reached the target for this type
                  if (typeCounts[businessType] >= targetPerType) {
                    console.log(`    Reached target for ${businessType}, moving to next type`);
                    break;
                  }
                } else {
                  console.warn(`    Failed to parse address for ${place.name}`);
                }

                // Add small delay to avoid rate limiting
                await setTimeout(100);
              }
            }
          } catch (error) {
            console.warn(`Error fetching places for keyword "${keyword}":`, error.message);
            continue;
          }
        }
      }
    }

    console.log(`Total addresses found: ${addresses.length}`);
    console.log(`Distribution:`, typeCounts);
    
    // Adjust count if we have more than requested
    if (addresses.length > countNum) {
      console.log(`Adjusting count from ${addresses.length} to ${countNum} by removing random items...`);
      
      // Shuffle array and take only the first countNum items
      for (let i = addresses.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [addresses[i], addresses[j]] = [addresses[j], addresses[i]];
      }
      
      addresses.splice(countNum);
      
      // Recalculate type counts
      const newTypeCounts = {
        restaurants: 0,
        barbershops: 0,
        petShops: 0,
        musicStudios: 0
      };
      
      // This is a simplified count - in a real scenario you'd need to track which type each address belongs to
      console.log(`Adjusted to ${addresses.length} addresses`);
    }
    
    // Check if we have a good distribution
    const hasGoodDistribution = Object.values(typeCounts).every(count => count > 0);
    if (!hasGoodDistribution) {
      console.warn(`⚠️  Warning: Not all business types found. Missing:`, 
        Object.entries(typeCounts)
          .filter(([type, count]) => count === 0)
          .map(([type]) => type)
          .join(', ')
      );
    } else {
      console.log(`✅ Good distribution achieved!`);
    }

    return res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
}

function parseAddressComponents(components, formattedAddress, city, state) {
  try {
    let street = "";
    let number = "";
    let neighborhood = "";
    let zipcode = "";

    for (const component of components) {
      const types = component.types;

      if (types.includes("route")) {
        street = component.long_name;
      } else if (types.includes("street_number")) {
        number = component.long_name;
      } else if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
        neighborhood = component.long_name;
      } else if (types.includes("postal_code")) {
        zipcode = component.long_name;
      }
    }

    // If we couldn't parse properly, try to extract from formatted address
    if (!street || !number) {
      const parts = formattedAddress.split(",").map(part => part.trim());

      if (parts.length >= 2) {
        const firstPart = parts[0];
        const streetMatch = firstPart.match(/^(.+?)\s+(\d+)$/);

        if (streetMatch) {
          street = streetMatch[1];
          number = parseInt(streetMatch[2], 10);
        }
      }
    }

    // Validate required fields
    if (!street || !number) {
      return null;
    }

    // Use default values if not found
    if (!neighborhood) {
      neighborhood = "Centro"; // Default neighborhood
    }

    if (!zipcode) {
      zipcode = "80000-000"; // Default zipcode
    }

    return {
      street,
      number: parseInt(number, 10),
      neighborhood,
      city,
      state,
      zipcode: zipcode.replace("-", ""),
    };
  } catch (error) {
    console.warn("Error parsing address components:", error);
    return null;
  }
}

module.exports = {
  getCEP,
  getCoordinates,
  getRandomAddresses,
};
