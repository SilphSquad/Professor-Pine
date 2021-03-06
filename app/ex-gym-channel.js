"use strict";

const Gym = require('./gym'),
  Helper = require('./helper'),
  Raid = require('./raid');

class ExGymChannel {
  constructor() {
  }

  initialize() {
    Helper.client.on('raidCreated', async (raid, reportingMemberId) => {
      const gym = await Gym.getGym(raid.gymId);

      if ((gym.confirmedEx || gym.taggedEx) && !raid.isExclusive) {
        return raid.createPotentialExRaidMessage();
      } else {
        return false;
      }
    });
  }
}

module.exports = new ExGymChannel();
