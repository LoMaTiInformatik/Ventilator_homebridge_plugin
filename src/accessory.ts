/*
  *
  * Der gesamte Code (außer explizit markiert) wurde von Lois Gilly geschrieben.
  * Homebridge Example Plugin: (https://github.com/homebridge/homebridge-examples/tree/master/accessory-example-typescript)
  * 
*/

// Code aus dem Homebridge Example Plugin (Start)
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
// Code aus dem Homebridge Example Plugin (Ende)

import axios from 'axios';
import { json } from "stream/consumers";

// Code aus dem Homebridge Example Plugin (Start)
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
  api.registerAccessory("homebridge-arduino-ventilator-lomati", "Ventilator", VentilatorPl);
};

class VentilatorPl implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  // Code aus dem Homebridge Example Plugin (Ende)
  private readonly ip: string;
  private status;
  private queue = {
    power: 0,
    speed: 0,
    swing: 0
  };
  private processrequest = false;

  // Code aus dem Homebridge Example Plugin (Start)
  private readonly ventilatorService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    // Code aus dem Homebridge Example Plugin (Ende)
    this.ip = "http://" + config.ip;
    this.status = {
      power: 0,
      speed: 0,
      swing: 0
    };
    //this.communicate(0, "no", 0);

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

    // Code aus dem Homebridge Example Plugin (Start)
      log.info("Switch finished initializing!");
    // Code aus dem Homebridge Example Plugin (Ende)
    setInterval(() => {
      this.managequeue();
    }, 1000 * 3);
  }

  // Handle requests

  handleActiveGet() {
    switch (this.status.power) {
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
          this.communicate(1, "speed", 0);
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
    let num = Math.ceil(valnum / 25);
    if (num >= 4) {num = 4;}
    if (valnum == 0) {num = 0;}
    this.communicate(1, "speed", num);
  }
  handleSwingModeGet() {
    switch (this.status.swing) {
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
        this.communicate(1, "swing", 0);
        break;
      case hap.Characteristic.SwingMode.SWING_ENABLED:
        this.communicate(1, "swing", 1);
        break;
    }
  }

  // Utils
  async managequeue() {
    if (this.queue != this.status) {
      if (this.processrequest == false) {
        let i = 1;
        let act = "";
        let val: number = 0;
        if (i == 1) {
          if (this.queue.speed != this.status.speed) {
            act = "speed";
            val = this.queue.speed;
          } else {
            i++;
          }
        }
        if (i == 2) {
          if (this.queue.swing != this.status.swing) {
            act = "swing";
            val = this.queue.swing;
          } else {
            i++;
          }
        }
        if (i >= 3) {
          this.log.debug("No request to make");
          return;
        }
        let response;
        try {
          response = await axios.get((this.ip + "/?act=" + act + "&arg1=" + String(val)), { timeout: 2000 });
        } catch(errmsgaxios) {
          this.log.debug("An error occoured while getting the data: " + errmsgaxios);
          setTimeout(() => {this.processrequest = false;}, 1000);
          return;
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
        this.log.debug(s);

        const data = JSON.parse(s);
        if (response.status == 400) {
          const text = "An error occured while getting the data: ";
          console.warn(text + data.errmsg);
        }
        this.status = data;
        this.queue[act] = data[act];
        this.log.debug("Request handled");
        setTimeout(() => {this.processrequest = false;}, 1000);
      } else {
        const text = "An error occured while getting the data: Already processing request!";
        this.log.debug(text);
      }
    }
    return;
  }

  async communicate(type: number, act: string, value: number) {
    switch (type) {
      case 0:
        if (this.processrequest == false) {
          this.processrequest = true;
          try {
            let response;
            response = await axios.get((this.ip + "/getStatus"), { timeout: 2000 });
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
            console.log(s);

            const data = JSON.parse(s);
            if (response.status == 400) {
              const text = "An error occured while getting the data: ";
              console.warn(text + data.errmsg);
            }
            this.status = data;
            this.queue = data;
          } catch (err: any) {
            const text = "An error occured while getting the data: ";
            console.warn(text + err.message);
          }
          setTimeout(() => {this.processrequest = false;}, 1000);
        } else {
          const text = "An error occured while getting the data: Already processing request!";
          console.warn(text);
          this.status = {
            power: 0,
            speed: 0,
            swing: 0
          }
        }
        break;

      case 1:
        this.queue[act] = value;
        break;
    }
    return;
  }

  // Code aus dem Homebridge Example Plugin (Start)

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

  // Code aus dem Homebridge Example Plugin (Ende)

}
