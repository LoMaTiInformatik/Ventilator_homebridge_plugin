import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  HapStatusError,
  Logging,
  Service
} from "homebridge";

import axios from 'axios';
import { json } from "stream/consumers";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("Ventilator", VentilatorPl);
};

class VentilatorPl implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly ip: string;
  private status;

  private readonly ventilatorService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.ip = "http://" + config.ip;
    this.status = {
      power: 0,
      speed: 0,
      swing: 0
    };
    this.communicate(0, "no", 0).then((rep) => {
      this.status = rep;
    });

    this.ventilatorService = new hap.Service.Fanv2(this.name);
    this.ventilatorService.getCharacteristic(hap.Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.ventilatorService.getCharacteristic(hap.Characteristic.RotationSpeed)
      .onGet(this.handleRotationSpeedGet.bind(this))
      .onSet(this.handleRotationSpeedSet.bind(this));

    this.ventilatorService.getCharacteristic(hap.Characteristic.SwingMode)
      .onGet(this.handleSwingModeGet.bind(this))
      .onSet(this.handleSwingModeSet.bind(this));

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "LoMaTi")
      .setCharacteristic(hap.Characteristic.Model, "Arduino Ventilator")
      .setCharacteristic(hap.Characteristic.SerialNumber, "FAN001");

    log.info("Switch finished initializing!");
    /*setInterval(() => {
      this.communicate(0, "no", 0).then((rep) => {
        this.status = rep;
      });
    }, 1000 * 30);*/
  }

  // Handle requests

  handleActiveGet() {
    switch(this.status.power) {
      case 0:
        return hap.Characteristic.Active.INACTIVE;
      case 1:
        return hap.Characteristic.Active.ACTIVE;
      default:
        this.log.debug("Got invalid response power");
        return hap.Characteristic.Active.INACTIVE;
    }
  }
  handleActiveSet(value: CharacteristicValue) {
    const curval = this.status.power;
    if (true) {
      switch (value) {
        case hap.Characteristic.Active.INACTIVE:
          this.communicate(1, "power", 0).then((rep) => {
            this.status = rep;
          });
          this.log.debug("Power 0");
          break;
        case hap.Characteristic.Active.ACTIVE:
          /*
          this.communicate(1, "power", 1).then((rep) => {
            this.status = rep;
          });
          */
          this.log.debug("Power 1");
          break;
      }
    }
  }
  handleRotationSpeedGet() {
    return (this.status.speed * 25);
  }
  handleRotationSpeedSet(value: CharacteristicValue) {
    const valnum: any = value.valueOf();
    let num = Math.floor(valnum / 25);
    this.communicate(1, "speed", num).then((rep) => {
      this.status = rep;
    });
  }
  handleSwingModeGet() {
    switch(this.status.swing) {
      case 0:
        return hap.Characteristic.SwingMode.SWING_DISABLED;
      case 1:
        return hap.Characteristic.SwingMode.SWING_ENABLED;
      default:
        this.log.debug("Got invalid response swing");
        return hap.Characteristic.SwingMode.SWING_DISABLED;
    }
  }
  handleSwingModeSet(value: CharacteristicValue) {
    switch (value) {
      case hap.Characteristic.SwingMode.SWING_DISABLED:
        this.communicate(1, "swing", 0).then((rep) => {
          this.status = rep;
        });
        break;
      case hap.Characteristic.SwingMode.SWING_ENABLED:
        this.communicate(1, "swing", 1).then((rep) => {
          this.status = rep;
        });
        break;
    }
  }

  // Utils

  async communicate(type: number, act: string, value: number) {
    let response;
    switch (type) {
      case 0:
        try {
          response = await axios.get(this.ip + "/getStatus", {timeout: 2000});
        } catch {
          return {
            power: 0,
            speed: 0,
            swing: 0
          };
        }
        break;

      case 1:
        try {
          response = await axios.get(this.ip + "/?act=" + act + "&arg1=" + String(value), {timeout: 3000});
        } catch {
          return {
            power: 0,
            speed: 0,
            swing: 0
          };
        }
        break;

    }
    let s = String(response.data);
    s = s.replace(/\\n/g, '\\n')
      .replace(/\\'/g, '\\\'')
      .replace(/\\"/g, '\"')
      .replace(/\\&/g, '\\&')
      .replace(/\\r/g, '\\r')
      .replace(/\\t/g, '\\t')
      .replace(/\\b/g, '\\b')
      .replace(/\\f/g, '\\f');
    // Remove non-printable and other non-valid JSON characters
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[\u0000-\u0019]+/g, '');
    console.log(response.data);
    console.log(s);

    const data = JSON.parse(s);
    if (response.status == 400) {
      const text = "An error occured while getting the data: ";
      console.log(text + data.errmsg);
      return {
        power: 0,
        speed: 0,
        swing: 0
      };
    }
    return data;
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.ventilatorService,
    ];
  }

}
