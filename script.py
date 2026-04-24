def reverse_name(name):
  names = name.split()
  return ' '.join(reversed(names))
def main():
  try:
    name = input().strip()
    if not name:
      print('Invalid input')
    else:
      print(reverse_name(name))
  except Exception as e:
    pass
if __name__ == '__main__':
  main()