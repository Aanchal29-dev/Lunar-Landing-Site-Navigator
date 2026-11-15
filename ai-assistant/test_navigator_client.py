import unittest
from unittest.mock import Mock, patch

import requests

import navigator_client


class NavigatorClientTests(unittest.TestCase):
    def setUp(self):
        self.payload = {"latitude_deg": -85.0, "longitude_deg": 20.0}
        self.response_data = {"result": "backend response"}

    def _successful_response(self):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = self.response_data
        return response

    @patch("navigator_client.requests.request")
    def test_visibility_posts_payload_and_returns_backend_json(self, request):
        request.return_value = self._successful_response()

        result = navigator_client.analyze_visibility(self.payload)

        self.assertEqual(result, self.response_data)
        request.assert_called_once_with(
            "POST",
            "http://127.0.0.1:8000/api/analyze",
            json=self.payload,
            timeout=navigator_client.VISIBILITY_TIMEOUT_SECONDS,
        )

    @patch("navigator_client.requests.request")
    def test_ice_search_posts_payload(self, request):
        request.return_value = self._successful_response()

        result = navigator_client.find_nearby_ice(self.payload)

        self.assertEqual(result, self.response_data)
        self.assertEqual(request.call_args.args[:2], (
            "POST", "http://127.0.0.1:8000/api/analyze-site"
        ))
        self.assertEqual(request.call_args.kwargs["json"], self.payload)
        self.assertEqual(request.call_args.kwargs["timeout"], 10)

    @patch("navigator_client.requests.request")
    def test_historical_missions_uses_get(self, request):
        request.return_value = self._successful_response()

        result = navigator_client.get_historical_missions()

        self.assertEqual(result, self.response_data)
        self.assertEqual(request.call_args.args[:2], (
            "GET", "http://127.0.0.1:8000/api/missions"
        ))
        self.assertIsNone(request.call_args.kwargs["json"])
        self.assertEqual(request.call_args.kwargs["timeout"], 10)

    @patch("navigator_client.requests.request")
    def test_terrain_posts_payload(self, request):
        request.return_value = self._successful_response()

        result = navigator_client.analyze_terrain(self.payload)

        self.assertEqual(result, self.response_data)
        self.assertEqual(request.call_args.args[:2], (
            "POST", "http://127.0.0.1:8000/api/terrain/analyze"
        ))

    @patch("navigator_client.requests.request")
    def test_comparison_posts_payload(self, request):
        request.return_value = self._successful_response()

        result = navigator_client.compare_sites(self.payload)

        self.assertEqual(result, self.response_data)
        self.assertEqual(request.call_args.args[:2], (
            "POST", "http://127.0.0.1:8000/api/compare"
        ))

    @patch("navigator_client.requests.request")
    def test_backend_unavailable_raises_connection_error(self, request):
        request.side_effect = requests.ConnectionError("connection refused")

        with self.assertRaisesRegex(
            navigator_client.NavigatorConnectionError,
            "Could not connect to the Lunar Compass backend",
        ):
            navigator_client.get_historical_missions()

    @patch("navigator_client.requests.request")
    def test_http_error_includes_status(self, request):
        response = Mock()
        response.status_code = 503
        response.raise_for_status.side_effect = requests.HTTPError("unavailable")
        request.return_value = response

        with self.assertRaisesRegex(
            navigator_client.NavigatorHTTPError, "HTTP 503"
        ):
            navigator_client.analyze_visibility(self.payload)

    @patch("navigator_client.requests.request")
    def test_timeout_raises_timeout_error(self, request):
        request.side_effect = requests.Timeout("slow response")

        with self.assertRaisesRegex(
            navigator_client.NavigatorTimeoutError,
            f"timed out after {navigator_client.VISIBILITY_TIMEOUT_SECONDS} seconds",
        ):
            navigator_client.analyze_visibility(self.payload)


if __name__ == "__main__":
    unittest.main()
