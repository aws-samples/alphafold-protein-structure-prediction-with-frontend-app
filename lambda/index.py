import os
from http import HTTPStatus

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler.api_gateway import (
    ApiGatewayResolver,
    CORSConfig,
)
from aws_lambda_powertools.logging import correlation_paths

import jobs
from common import NotFoundError, make_response

logger = Logger()
app = ApiGatewayResolver(cors=CORSConfig(allow_origin=os.environ["ALLOW_ORIGIN"]))
app.include_router(jobs.router)


@app.exception_handler(NotFoundError)
def handle_not_found(e):
    metadata = {"path": app.current_event.path}
    logger.warn(f"NotFoundError: {e}", extra=metadata)
    return make_response({"error": str(e)}, HTTPStatus.NOT_FOUND)


@app.exception_handler(ValueError)
def handle_value_error(e):
    metadata = {"path": app.current_event.path}
    logger.warn(f"ValueError: {e}", extra=metadata)
    return make_response({"error": str(e)}, HTTPStatus.BAD_REQUEST)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def handler(event, context):
    return app.resolve(event, context)
