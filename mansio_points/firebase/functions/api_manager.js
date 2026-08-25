const axios = require("axios").default;
const qs = require("qs");

async function _consultarPagamantoCall(context, ffVariables) {
  var apiKey = ffVariables["apiKey"];
  var orderId = ffVariables["orderId"];

  var url = `https://api.pagseguro.com/orders/${orderId}`;
  var headers = { Authorization: `Bearer ${apiKey}`, accept: `*/*` };
  var params = {};
  var ffApiRequestBody = undefined;

  return makeApiRequest({
    method: "get",
    url,
    headers,
    params,
    returnBody: true,
    isStreamingApi: false,
  });
}
async function _criarTranferenciaCall(context, ffVariables) {
  var apiKey = ffVariables["apiKey"];
  var preco = ffVariables["preco"];
  var cpf = ffVariables["cpf"];
  var descricao = ffVariables["descricao"];
  var cliente = ffVariables["cliente"];
  var email = ffVariables["email"];
  var id = ffVariables["id"];
  var porcentagem = ffVariables["porcentagem"];

  var url = `https://api.pagseguro.com/orders`;
  var headers = {
    Authorization: `Bearer ${apiKey}`,
    accept: `*/*`,
    "content-type": `application/json`,
  };
  var params = {};
  var ffApiRequestBody = `
{
  "customer": {
    "name": "${escapeStringForJson(cliente)}",
    "email": "${escapeStringForJson(email)}",
    "tax_id": "${escapeStringForJson(cpf)}"
  },
  "reference_id": "${escapeStringForJson(descricao)}",
  "qr_codes": [
    {
      "amount": {
        "value": "${escapeStringForJson(preco)}"
      }
    }
  ]
}`;

  return makeApiRequest({
    method: "post",
    url,
    headers,
    params,
    body: createBody({
      headers,
      params,
      body: ffApiRequestBody,
      bodyType: "JSON",
    }),
    returnBody: true,
    isStreamingApi: false,
  });
}
async function _calcularFreteCall(context, ffVariables) {
  var token = ffVariables["token"];
  var cepEnvio = ffVariables["cepEnvio"];
  var cepDestino = ffVariables["cepDestino"];
  var id = ffVariables["id"];
  var largura = ffVariables["largura"];
  var altura = ffVariables["altura"];
  var comprimento = ffVariables["comprimento"];
  var peso = ffVariables["peso"];
  var valorProduto = ffVariables["valorProduto"];
  var quantidade = ffVariables["quantidade"];

  var url = `https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate`;
  var headers = {
    Accept: `application/json`,
    Authorization: `Bearer ${token}`,
    "Content-Type": `application/json`,
    "User-Agent": `Aplicação suporte@ori.dev.br`,
    accept: `application/json`,
  };
  var params = {};
  var ffApiRequestBody = `
{
  "from": {
    "postal_code": "${cepEnvio}"
  },
  "to": {
    "postal_code": "${cepDestino}"
  },
  "products": [
    {
      "id": "${id}",
      "width": ${largura},
      "height": ${altura},
      "length": ${comprimento},
      "weight": ${peso},
      "insurance_value": ${valorProduto},
      "quantity": ${quantidade}
    }
  ]
}`;

  return makeApiRequest({
    method: "post",
    url,
    headers,
    params,
    body: createBody({
      headers,
      params,
      body: ffApiRequestBody,
      bodyType: "JSON",
    }),
    returnBody: true,
    isStreamingApi: false,
  });
}

/// Helper functions to route to the appropriate API Call.

async function makeApiCall(context, data) {
  var callName = data["callName"] || "";
  var variables = data["variables"] || {};

  const callMap = {
    ConsultarPagamantoCall: _consultarPagamantoCall,
    CriarTranferenciaCall: _criarTranferenciaCall,
    CalcularFreteCall: _calcularFreteCall,
  };

  if (!(callName in callMap)) {
    return {
      statusCode: 400,
      error: `API Call "${callName}" not defined as private API.`,
    };
  }

  var apiCall = callMap[callName];
  var response = await apiCall(context, variables);
  return response;
}

async function makeApiRequest({
  method,
  url,
  headers,
  params,
  body,
  returnBody,
  isStreamingApi,
}) {
  return axios
    .request({
      method: method,
      url: url,
      headers: headers,
      params: params,
      responseType: isStreamingApi ? "stream" : "json",
      ...(body && { data: body }),
    })
    .then((response) => {
      return {
        statusCode: response.status,
        headers: response.headers,
        ...(returnBody && { body: response.data }),
        isStreamingApi: isStreamingApi,
      };
    })
    .catch(function (error) {
      return {
        statusCode: error.response.status,
        headers: error.response.headers,
        ...(returnBody && { body: error.response.data }),
        error: error.message,
      };
    });
}

const _unauthenticatedResponse = {
  statusCode: 401,
  headers: {},
  error: "API call requires authentication",
};

function createBody({ headers, params, body, bodyType }) {
  switch (bodyType) {
    case "JSON":
      headers["Content-Type"] = "application/json";
      return body;
    case "TEXT":
      headers["Content-Type"] = "text/plain";
      return body;
    case "X_WWW_FORM_URL_ENCODED":
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      return qs.stringify(params);
  }
}
function escapeStringForJson(val) {
  if (typeof val !== "string") {
    return val;
  }
  return val
    .replace(/[\\]/g, "\\\\")
    .replace(/["]/g, '\\"')
    .replace(/[\n]/g, "\\n")
    .replace(/[\t]/g, "\\t");
}

module.exports = { makeApiCall };
