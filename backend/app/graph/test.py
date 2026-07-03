from connection import get_neo4j_connection


def main():
    neo4j_conn = get_neo4j_connection()
    neo4j_conn.verify_connection()

    query = """
    RETURN "Hello from Neo4j" AS message
    """

    result = neo4j_conn.execute_query(query)

    print(result)

    neo4j_conn.close()


if __name__ == "__main__":
    main()
