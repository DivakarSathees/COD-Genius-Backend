import sys
import json

class Book:
    def __init__(self, book_id, title, author, publication_year):
        self.book_id = book_id
        self.title = title
        self.author = author
        self.publication_year = publication_year

class Library:
    def __init__(self):
        self.books = {}

    def add_book(self, book_id, title, author, publication_year):
        self.books[book_id] = Book(book_id, title, author, publication_year)

    def remove_book(self, book_id):
        if book_id in self.books:
            del self.books[book_id]
        else:
            print('Book not found')

    def search_book(self, book_id):
        if book_id in self.books:
            book = self.books[book_id]
            print(f'{book.book_id} {book.title} {book.author} {book.publication_year}')
        else:
            print('Book not found')

def main():
    library = Library()
    try:
        num_books = int(sys.stdin.readline().strip())
        for _ in range(num_books):
            book_id, title, author, publication_year = sys.stdin.readline().strip().split(',', 3)
            library.add_book(book_id, title, author, publication_year)
        while True:
            try:
                line = sys.stdin.readline().strip()
                if not line:
                    break
                command, book_id = line.split(' ', 1)
                if command == 'search':
                    library.search_book(book_id)
                elif command == 'remove':
                    library.remove_book(book_id)
            except Exception as e:
                pass
    except Exception as e:
        pass
if __name__ == '__main__':
    main()