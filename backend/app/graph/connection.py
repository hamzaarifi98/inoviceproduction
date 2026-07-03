import os
from dotenv import load_dotenv
load_dotenv()
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError


_neo4j_conn = None


class Neo4jConnection:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI")
        self.username = os.getenv("NEO4J_USERNAME")
        self.password = os.getenv("NEO4J_PASSWORD")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")

        if not self.uri:
            raise ValueError("NEO4J_URI is missing in .env")

        if not self.username:
            raise ValueError("NEO4J_USERNAME is missing in .env")

        if not self.password:
            raise ValueError("NEO4J_PASSWORD is missing in .env")

        self.driver = GraphDatabase.driver(
            self.uri,
            auth=(self.username, self.password)
        )

    def verify_connection(self):
        try:
            self.driver.verify_connectivity()
            print("Connected to Neo4j successfully")
        except AuthError:
            print("Neo4j authentication failed. Check username/password.")
            raise
        except ServiceUnavailable:
            print("Neo4j is unavailable. Check if Neo4j Desktop instance is running.")
            raise

    def close(self):
        if self.driver:
            self.driver.close()

    def execute_query(self, query: str, parameters: dict | None = None):
        parameters = parameters or {}

        with self.driver.session(database=self.database) as session:
            result = session.run(query, parameters)
            return [record.data() for record in result]


def get_neo4j_connection() -> Neo4jConnection:
    global _neo4j_conn

    if _neo4j_conn is None:
        _neo4j_conn = Neo4jConnection()

    return _neo4j_conn
