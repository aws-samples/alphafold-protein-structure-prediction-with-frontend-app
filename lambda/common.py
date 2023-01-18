import json
from decimal import Decimal
from http import HTTPStatus

from aws_lambda_powertools.event_handler.api_gateway import Response, Router

router = Router()


class NotFoundError(Exception):
    pass


def deserialize(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, set):
        return list(obj)
    return None


def make_response(body="", status_code=HTTPStatus.OK):
    return Response(
        status_code=status_code,
        content_type="application/json",
        body=json.dumps(body, default=deserialize),
    )
