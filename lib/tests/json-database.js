//@ts-check
/**
 * @typedef {object} User
 * @prop {number=} Id
 * @prop {string} FirstName
 * @prop {string} LastName
 * @prop {number=} CarId
 * @prop {Car=} Car
 */

/**
 * @typedef {object} Car
 * @prop {number=} Id
 * @prop {string} Make
 * @prop {string} Model
 * @prop {string} Color
 * @prop {number} Year
 * @prop {number} Mileage 
 * @prop {number} MPGCity 
 * @prop {number} MPGHwy
 * @prop {User} Owner 
 */

/** @type {import('@myorm/json-adapter').JsonDatabase} */
export const database = {
    $schema: {
        Car: {
            Id: {
                table: "Car",
                field: "Id",
                alias: "",
                isPrimary: true,
                isIdentity: true,
                isVirtual: false,
                isNullable: false,
                datatype: 'int',
                defaultValue: () => undefined
            },
            Make: {
                table: "Car",
                field: "Make",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: false,
                datatype: 'string',
                defaultValue: () => undefined
            },
            Model: {
                table: "Car",
                field: "Model",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: false,
                datatype: 'string',
                defaultValue: () => undefined
            },
            Color: {
                table: "Car",
                field: "Color",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: true,
                datatype: 'string',
                defaultValue: () => undefined
            },
            Year: {
                table: "Car",
                field: "Year",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: true,
                datatype: 'int',
                defaultValue: () => undefined
            },
            Mileage: {
                table: "Car",
                field: "Mileage",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: true,
                datatype: 'int',
                defaultValue: () => undefined
            },
            MPGHwy: {
                table: "Car",
                field: "MPGHwy",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: true,
                datatype: 'float',
                defaultValue: () => undefined
            },
            MPGCity: {
                table: "Car",
                field: "MPGCity",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: true,
                datatype: 'float',
                defaultValue: () => undefined
            },
        },
        User: {
            Id: {
                table: "User",
                field: "Id",
                alias: "",
                isPrimary: true,
                isIdentity: true,
                isVirtual: false,
                isNullable: false,
                datatype: 'int',
                defaultValue: () => undefined
            },
            FirstName: {
                table: "User",
                field: "FirstName",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: false,
                datatype: 'string',
                defaultValue: function () {
                    throw new Error("Function not implemented.");
                }
            },
            LastName: {
                table: "User",
                field: "LastName",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                isNullable: false,
                datatype: 'string',
                defaultValue: function () {
                    throw new Error("Function not implemented.");
                }
            }
        }
    },
    $data: {
        Car: [
            { Id: 1, Make: "Ford", Model: "Focus", Color: "Yellow", Year: 2020, Mileage: 32145, MPGHwy: 37.6, MPGCity: 26.2 },
            { Id: 2, Make: "Toyota", Model: "Tundra", Color: "Red", Year: 2014, Mileage: 121419, MPGHwy: 32.9, MPGCity: 21.7 },
            { Id: 3, Make: "Ford", Model: "Fusion", Color: "Red", Year: 2019, Mileage: 69225, MPGHwy: 34.3, MPGCity: 26.9 },
            { Id: 4, Make: "Chevy", Model: "Equinox", Color: "Red", Year: 2022, Mileage: 17143, MPGHwy: 35.1, MPGCity: 22.4 },
            { Id: 5, Make: "Ford", Model: "Escape", Color: "Blue", Year: 2022, Mileage: 13417, MPGHwy: 34.9, MPGCity: 20.6 },
            { Id: 6, Make: "Toyota", Model: "Tacoma", Color: "Blue", Year: 2023, Mileage: 499, MPGHwy: 29.7, MPGCity: 16.4 },
            { Id: 7, Make: "Ford", Model: "F150", Color: "Blue", Year: 2020, Mileage: 51222, MPGHwy: 28.6, MPGCity: 17.0 },
            { Id: 8, Make: "Chevy", Model: "Malibu", Color: "White", Year: 2018, Mileage: 67446, MPGHwy: 37.2, MPGCity: 23.7 },
            { Id: 9, Make: "Toyota", Model: "Tacoma", Color: "White", Year: 2023, Mileage: 2747, MPGHwy: 30.1, MPGCity: 16.8 },
            { Id: 10, Make: "Dodge", Model: "Charger", Color: "White", Year: 2022, Mileage: 7698, MPGHwy: 29.9, MPGCity: 14.1 },
            { Id: 11, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2021, Mileage: 21567, MPGHwy: 28.2, MPGCity: 13.8 },
            { Id: 12, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2013, Mileage: 123411, MPGHwy: 28.1, MPGCity: 14.1 },
            { Id: 13, Make: "Dodge", Model: "Hornet", Color: "Black", Year: 2013, Mileage: 108753, MPGHwy: 31.5, MPGCity: 16.9 },
            { Id: 14, Make: "Chevy", Model: "Malibu", Color: "Silver", Year: 2021, Mileage: 14353, MPGHwy: 34.9, MPGCity: 20.0 },
            { Id: 15, Make: "Dodge", Model: "Charger", Color: "Silver", Year: 2020, Mileage: 92442, MPGHwy: 26.6, MPGCity: 13.1 },
        ]
    }
};