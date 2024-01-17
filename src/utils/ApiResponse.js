// standarizing api response (not a core part of nodejs but we can still do it)
class ApiResponse {
    constructor(statusCode,data,message="Success"){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

export {ApiResponse}