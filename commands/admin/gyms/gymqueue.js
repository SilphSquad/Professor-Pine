const commando = require('discord.js-commando'),
  log = require('loglevel').getLogger('GymQueueCommand'),
  oneLine = require('common-tags').oneLine,
  Gym = require('../../../app/gym'),
  Helper = require('../../../app/helper'),
  {CommandGroup} = require('../../../app/constants');

module.exports = class CheckGymQueue extends commando.Command {
  constructor(client) {
    super(client, {
      name: 'gymqueue',
      aliases: [],
      group: CommandGroup.REGION,
      memberName: 'gymqueue',
      description: 'Get current queues waiting for update.',
      details: oneLine`
				This command will identify channels waiting to be reindexed and gyms waiting for places updates.
			`,
      examples: ['\tgymqueue']
    });

    client.dispatcher.addInhibitor(message => {
      if (!!message.command && message.command.name === 'gymqueue') {
        if (!Helper.isManagement(message)) {
          return ['unauthorized', message.reply('You are not authorized to use this command.')];
        }
        if (!Helper.isBotChannel(message)) {
          return ['invalid-channel', message.reply('This command must be ran in a bot channel.')]
        }
      }
      return false;
    });
  }

  async run(msg) {
    let message = "Gyms waiting for places updates```";
    if (Gym.getPlacesQueue().length > 0) {
      message += Gym.getPlacesQueue().join(", ");
    } else {
      message += "None";
    }
    message += "```";

    message += "Channels waiting to be reindexed```";
    if (Gym.getIndexQueue().length > 0) {
      message += "<#";
      message += Gym.getPlacesQueue().join(">, <#");
    } else {
      message += "None";
    }

    message += "```";

    // TODO: Use more sophisticated message splitting, but at least this should keep it from breaking if the list of
    // places and/or regions is long
    msg.say(message, {
      split: true
    }).catch(err => log.error(err));
  }
};
