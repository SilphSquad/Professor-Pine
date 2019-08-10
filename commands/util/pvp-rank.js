const log = require('loglevel').getLogger('RankCommand'),
  {CommandGroup} = require('../../app/constants'),
  Commando = require('discord.js-commando'),
  CpmData = require('../../data/cpm'),
  Helper = require('../../app/helper'),
  {MessageEmbed} = require('discord.js');

class PvPRankingData {
  constructor(command, arg, client) {
    this.arg = arg;
    this.command = command;
    this.pokemonCollector = new Commando.ArgumentCollector(client, [
      {
        key: 'pvpPokemon',
        prompt: 'Which species of Pokémon would you like to evaluate a specific IV combination PvP rank for?',
        type: 'counterpokemontype',
      }
    ], 3);
    this.attackCollector = new Commando.ArgumentCollector(client, [
      {
        key: 'attackIV',
        label: 'Attack IV',
        prompt: 'Please enter the Pokemon\'s Attack IV (Integer between 0 and 15)',
        type: 'integer',
        min: 0,
        max: 15
      }
    ], 3);
    this.defenseCollector = new Commando.ArgumentCollector(client, [
      {
        key: 'defenseIV',
        label: 'Defense IV',
        prompt: 'Please enter the Pokemon\'s Defense IV (Integer between 0 and 15)',
        type: 'integer',
        min: 0,
        max: 15
      }
    ], 3);
    this.staminaCollector = new Commando.ArgumentCollector(client, [
      {
        key: 'staminaIV',
        label: 'Stamina IV',
        prompt: 'Please enter the Pokemon\'s Stamina IV (Integer between 0 and 15)',
        type: 'integer',
        min: 0,
        max: 15
      }
    ], 3);
  }

  async getUserRequest(message) {
    let attackIV = [''],
      defenseIV = [''],
      staminaIV = [''],
      filter = [''],
      flag = true;

    let pokemonName = [''];
    let stringComponents = this.arg.split(' ');
    for (let i = 0; i < stringComponents.length; i++) {
      if (!Number(stringComponents[i]) && flag === true && stringComponents[i] !== '0') {
        pokemonName[0] += stringComponents[i] + ' ';
      } else {
        flag = false;
      }
      if ((Number(stringComponents[i]) || stringComponents[i] === '0') && !attackIV[0]) {
        attackIV[0] = stringComponents[i];
        if (Number(stringComponents[i + 1]) || stringComponents[i + 1] === '0') {
          defenseIV[0] = stringComponents[i + 1];
        }
        if (Number(stringComponents[i + 2]) || stringComponents[i + 2] === '0') {
          staminaIV[0] = stringComponents[i + 2];
        }
      }
    }
    pokemonName[0] = pokemonName[0].trim().replace('-', ' ');
    filter[0] = stringComponents[stringComponents.length - 1];
    if (Number(filter[0]) || filter[0] === '0') {
      filter[0] = [''];
    }

    this.ivFilter;
    this.cpLeague = this.command === 'ultra' ? 2500 : 1500;
    if (filter[0] === 'raid' || filter[0] === 'boss') {
      this.ivFilter = 10;
      this.ivFilterText = "Raid";
    } else if (filter[0] !== "10") {
      this.ivFilter = 0;
    }

    this.pokemon = await this.pokemonCollector.obtain(message, pokemonName); //Sees if pokemonName argument was included. If not, it prompts user for one.
    if (!this.pokemon.cancelled) {
      this.pokemon = this.pokemon.values.pvpPokemon;
    } else {
      this.flag = true; //This variable is used to stop the whole process (this function is nested- see displayInfo();)
      return;
    }
    this.attackIV = await this.attackCollector.obtain(message, attackIV); //Sees if Attack IV argument was included. If not, it prompts user for one.
    if (!this.attackIV.cancelled) {
      this.attackIV = this.attackIV.values.attackIV;
    } else {
      this.flag = true;
      return;
    }
    this.defenseIV = await this.defenseCollector.obtain(message, defenseIV); //Sees if Defense IV argument was included. If not, it prompts user for one.
    if (!this.defenseIV.cancelled) {
      this.defenseIV = this.defenseIV.values.defenseIV;
    } else {
      this.flag = true;
      return;
    }
    this.staminaIV = await this.staminaCollector.obtain(message, staminaIV); //Sees if Stamina IV argument was included. If not, it prompts user for one.
    if (!this.staminaIV.cancelled) {
      this.staminaIV = this.staminaIV.values.staminaIV;
    } else {
      this.flag = true;
      return;
    }

    this.embedName = this.pokemon.gsName[0];
    if (!this.pokemon.gsName[1]) { //If no more than 1 gsName, use 0 index for commandName.
      this.commandName = this.pokemon.gsName[0].replace(/ /g, '-').replace(/_/g, '-').toLowerCase();
      this.goStadiumName = this.pokemon.gsName[0];
    } else { //If more than 1 gsName, use 1 index for commandName.
      this.commandName = this.pokemon.gsName[1].replace(/ /g, '-').replace(/_/g, '-').toLowerCase();
      this.goStadiumName = this.pokemon.gsName[2];
    }

    if (parseInt(this.attackIV) < this.ivFilter || parseInt(this.defenseIV) < this.ivFilter || parseInt(this.staminaIV) < this.ivFilter) {
      this.embedErrorMessage = `IV outside of filter range. __**Minimum IV: ${this.ivFilter}**__`;
    }
  }

  calculateCp(baseAttack, baseDefense, baseStamina, attackIV, defenseIV, staminaIV, cpmMultiplier) {
    let totalAttack = baseAttack + attackIV,
      totalDefense = baseDefense + defenseIV,
      totalStamina = baseStamina + staminaIV;

    let cp = Math.floor((totalAttack * (totalDefense ** 0.5) * (totalStamina ** 0.5) * (cpmMultiplier ** 2)) / 10);

    return cp >= 10 ? cp : 10; // min CP is 10
  }

  generateRanks(cpmData) {
    if (this.flag === true) {
      return;
    }
    //If somebody cancels the command in scrape(), we don't want this function running.
    let ivArr = [],
      level,
      cpmMultiplier,
      cp,
      rawAttack,
      rawDefense,
      rawStamina;

    let baseAttack = this.pokemon.atk,
      baseDefense = this.pokemon.def,
      baseStamina = this.pokemon.sta;

    // insert the cpm data to iterate calculating from level 40 down
    let reversedCpmData = cpmData.slice().reverse(); // slice to not mutate original array

    // Iterates through each of the 4096 IV combinations (0-15).
    // Then starting at level 40, calculate the CP of the Pokemon at that IV.
    // If it is less than the league cap, add to the IV list and stop calculating.
    // The best will always be the highest level under the cap for a given IV.
    for (let attackIV = this.ivFilter; attackIV <= 15; attackIV++) {
      for (let defenseIV = this.ivFilter; defenseIV <= 15; defenseIV++) {
        for (let staminaIV = this.ivFilter; staminaIV <= 15; staminaIV++) {
          for (let cpmLevel of reversedCpmData) {
            level = cpmLevel.level;
            cpmMultiplier = cpmLevel.cpmMultiplier;
            cp = this.calculateCp(baseAttack, baseDefense, baseStamina, attackIV, defenseIV, staminaIV, cpmMultiplier);
            if (cp <= this.cpLeague) {
              rawAttack = (baseAttack + attackIV) * cpmMultiplier;
              rawDefense = (baseDefense + defenseIV) * cpmMultiplier;
              rawStamina = Math.floor((baseStamina + staminaIV) * cpmMultiplier);
              ivArr.push({
                rawAtk: rawAttack,
                rawDef: rawDefense,
                rawSta: rawStamina,
                atkIv: attackIV,
                defIv: defenseIV,
                staIv: staminaIV,
                ivTotal: attackIV + defenseIV + staminaIV,
                statProduct: Math.round(rawAttack * rawDefense * rawStamina),
                rawStatProduct: rawAttack * rawDefense * rawStamina,
                level: level,
                cp: cp
              });
              break;
            }
          }
        }
      }
    }

    // Sort by raw stat product DESC, iv total DESC, and cp DESC
    ivArr.sort((a, b) => {
      if (a.rawStatProduct > b.rawStatProduct) return -1;
      if (a.rawStatProduct < b.rawStatProduct) return 1;
      if (a.ivTotal > b.ivTotal) return -1;
      if (a.ivTotal < b.ivTotal) return 1;
      if (a.cp > b.cp) return -1;
      if (a.cp < b.cp) return 1;
      return 0;
    });

    // Add rank based on index
    ivArr.forEach((val, idx) => {
      val.rank = idx + 1;
    });

    // Add % max stat product
    ivArr.forEach(val => {
      val.pctMaxStatProduct = (val.rawStatProduct / ivArr[0].rawStatProduct) * 100;
    });

    let rankData = ivArr
      .filter(x => x.atkIv === this.attackIV && x.defIv === this.defenseIV && x.staIv === this.staminaIV)[0];
    if (!rankData) {
      return;
    }

    this.rank = rankData.rank;
    this.level = rankData.level;
    this.cp = rankData.cp;
    this.atk = rankData.rawAtk;
    this.def = rankData.rawDef;
    this.sta = rankData.rawSta;
    this.statproduct = rankData.statProduct;
    this.pctMaxStatProduct = rankData.pctMaxStatProduct;
    this.pctMaxStatProductStr = rankData.pctMaxStatProduct.toFixed(2).toString() + "%";
  }

  async displayInfo(message, command, isDM) {
    if (this.flag === true) {
      return;
    }

    //If somebody cancels the command in scrape(), we don't want this function running.
    function embedColor(statProductPercent) {
      if (statProductPercent >= 99) {
        return '#ffd700' //'#ffa500';
      } else if (statProductPercent < 99 && statProductPercent >= 97) {
        return '#c0c0c0' //'#ffff00';
      } else if (statProductPercent < 97 && statProductPercent >= 95) {
        return '#cd7f32' //'#228ec3';
      } else {
        return '#30839f' //'#f0f0f0';
      }
    }

    this.url = `https://gostadium.club/pvp/iv?pokemon=` +
      `${this.goStadiumName.replace(' ', '+')}` +
      `&max_cp=${this.cpLeague}` +
      `&min_iv=${this.ivFilter}` +
      `&att_iv=${this.attackIV}` +
      `&def_iv=${this.defenseIV}` +
      `&sta_iv=${this.staminaIV}`;

    let league = '';
    if (command === 'rank') {
      league = 'GREAT';
    } else {
      league = command.toUpperCase();
    }
    let embed;
    if (!this.embedErrorMessage) { //If no error message was found.
      let rankOutOf = this.ivFilterText ? `/${Math.pow((16 - this.ivFilter), 3).toString()}` : ''; //If there is a filter, then give a Rank/HowMany. Otherwise, blank variable.
      let requestInfo = `\n**[${league} LEAGUE](${this.url})\nRank**: ${this.rank}${rankOutOf} (${this.pctMaxStatProductStr})\n` + //requestInfo is League, rank, CP by default.
        `**CP**: ${this.cp} @ Level ${this.level}\n`;
      if (this.ivFilterText) { //Add filter line to requestInfo if a filter exists.
        requestInfo += `**Filter**: ${this.ivFilterText}\n`;
      }
      let nameField = `**${this.embedName.replace(/_/g, ' ').titleCase()}**  ${this.attackIV}/${this.defenseIV}/${this.staminaIV}\n`; //nameField is pokemon name & IVs.

      embed = new MessageEmbed()
        .setColor(embedColor(this.pctMaxStatProduct))
        .addField(nameField, requestInfo)
        .setThumbnail(this.pokemon.imageURL);

      if (!isDM) {
        embed.setFooter(`Requested by ${message.member.displayName}`, message.author.displayAvatarURL());
      }
    } else { //If rank was not found. This is due to an IV request outside of the allowed IVs per the IV filter. (Asking for rank of IV: 5 from a raid boss when minimum is 10)
      let nameField = `**${this.embedName.replace(/_/g, ' ').titleCase()}**  ${this.attackIV}/${this.defenseIV}/${this.staminaIV}\n`; //nameField is pokemon name & IVs.
      let requestInfo = `\n**[${league} LEAGUE](${this.url})\nRank**:   *Not Found*\n**CP**: *Not Found*\n**Error**: ${this.embedErrorMessage}`;
      embed = new MessageEmbed()
        .setColor('ff0000')
        .addField(nameField, requestInfo)
        .setThumbnail(this.pokemon.imageURL);

      if (!isDM) {
        embed.setFooter(`Requested by ${message.member.displayName}`, message.author.displayAvatarURL());
      }
    }
    let userCommand = `${message.client.commandPrefix}${command}`, //Grabs the !great, !ultra or w/e from user inputs.
      userPokemon = `${this.commandName}`, //Grabs the accepted Pokémon name.
      userIVString = `${this.attackIV} ${this.defenseIV} ${this.staminaIV}`; //Grabs the accepted IV sets (0-15 for ATK,DEF,STA)
    if (this.ivFilterText) {
      userIVString += ` ${this.ivFilterText}`
    }
    let responseCommand = `\`${userCommand} ${userPokemon} ${userIVString}\` results:`, //Combined the above into the whole accepted command.
      response = await message.channel.send(responseCommand.toLowerCase(), embed)
        .catch(err => log.error(err));
    response.preserve = true;
  }
}

class RankCommand extends Commando.Command {
  constructor(client) {
    super(client, {
      name: 'rank',
      group: CommandGroup.UTIL,
      memberName: 'rank',
      aliases: ['great', 'ultra'],
      description: 'Provides PvP data based on a Pokémon species\'s IVs, including rank and CP.',
      details: 'Use this command to obtain information on the PvP ranking of a specific IV combination for a specific species of Pokémon.' +
        '\n!great - This command restricts results to **Great League**\n!ultra - This command restricts results to **Ultra League**',
      examples: ['!<league> <Pokémon> <Attack IV> <Defense IV> <Stamina IV>\n!great altaria 4 1 2\n!ultra blastoise 10 14 15\n'],
      guarded: false
    });

    client.dispatcher.addInhibitor(message => {
      if (!!message.command && message.command.name === 'rank' && !Helper.isPvPCategory(message) && message.channel.type !== 'dm') {
        return ['invalid-channel', message.reply(Helper.getText('pvp-rank.warning', message))];
      }
      return false;
    });
  }

  async run(message, args) {
    String.prototype.titleCase = function () {
      return this.replace(/\w\S*/g, function (str) {
        return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
      });
    };

    const userCommand = message.content.toLowerCase()
      .match(`\\${message.client.options.commandPrefix}?(\\s+)?(\\S+)`)[2];

    if (userCommand === 'great' || userCommand === 'rank') {
      let greatRank = new PvPRankingData(userCommand, args, message.client);
      await greatRank.getUserRequest(message, CpmData);
      await greatRank.generateRanks(CpmData);
      await greatRank.displayInfo(message, userCommand, message.channel.type === 'dm');
    } else if (userCommand === 'ultra') {
      let ultraRank = new PvPRankingData(userCommand, args, message.client);
      await ultraRank.getUserRequest(message);
      await ultraRank.generateRanks(CpmData);
      await ultraRank.displayInfo(message, userCommand, message.channel.type === 'dm');
    }
  }
}

module.exports = RankCommand;