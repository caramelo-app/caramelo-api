const roleConstants = require("../../constants/roles.constants");
const statusConsts = require("../../constants/status.constants");

const { fakerPT_BR: faker } = require("@faker-js/faker");
const { generatePhoneNumber } = require("../../utils/data.utils");
const { hash } = require("../../utils/password.utils");

async function createDummyUser(options) {
  const user = {
    name: (() => {
      if (!options?.name) {
        return faker.person.fullName();
      }
      return options.name;
    })(),
    role: options?.role || roleConstants.USER_ROLES.CONSUMER,
    password: await hash(options?.password || faker.internet.password()),
    phone: (() => {
      if (!options?.phone) {
        return generatePhoneNumber();
      }
      return options.phone;
    })(),
    status: options?.status || statusConsts.RESOURCE_STATUS.PENDING,
    excluded: options?.excluded || false,
    validation_token: options?.validation_token || null,
    validation_token_expires_at: options?.validation_token_expires_at || null,
  };

  if (options?.role === roleConstants.USER_ROLES.CLIENT) {
    user.company_id = options.company_id;
  }

  return user;
}

module.exports = createDummyUser;
